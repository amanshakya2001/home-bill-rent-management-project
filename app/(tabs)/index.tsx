import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBills, getRentPayments, getSettings, type Bill, type Rent, type AppSettings } from '@/lib/database';
import { generateDashboardInsights } from '@/lib/openai';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [bills, setBills] = useState<Bill[]>([]);
  const [rents, setRents] = useState<Rent[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    apartment_name: 'My Apartment',
    bill_due_day: 10,
    rent_due_day: 1,
    notifications_enabled: 1,
  });
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const load = useCallback(async () => {
    const [b, r, s] = await Promise.all([getBills(db), getRentPayments(db), getSettings(db)]);
    setBills(b);
    setRents(r);
    setSettings(s);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function refreshInsights(billsData: Bill[], rentsData: Rent[]) {
    if (billsData.length === 0 && rentsData.length === 0) return;
    setLoadingInsights(true);
    setInsights(null);
    try {
      const text = await generateDashboardInsights({ bills: billsData, rents: rentsData });
      setInsights(text);
    } catch {
      setInsights('Could not load insights. Check your OpenAI API key in settings.');
    } finally {
      setLoadingInsights(false);
    }
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const unpaidBills = bills.filter(b => b.status === 'unpaid');
  const unpaidRents = rents.filter(r => r.status === 'unpaid');
  const totalPendingCount = unpaidBills.length + unpaidRents.length;
  const totalPendingAmount = unpaidBills.reduce((s, b) => s + b.total_amount, 0)
    + unpaidRents.reduce((s, r) => s + r.amount, 0);

  const currentBill = bills.find(b => b.month === currentMonth && b.year === currentYear);
  const currentRent = rents.find(r => r.month === currentMonth && r.year === currentYear);

  const recentItems = [
    ...bills.slice(0, 4).map(b => ({ ...b, type: 'bill' as const })),
    ...rents.slice(0, 4).map(r => ({ ...r, type: 'rent' as const })),
  ]
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
    .slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>Welcome back</Text>
        <Text style={styles.headerTitle}>{settings.apartment_name}</Text>
      </View>

      {totalPendingCount > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>
            {totalPendingCount} pending payment{totalPendingCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.alertAmount}>
            ₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>
        This Month — {MONTHS[currentMonth - 1]} {currentYear}
      </Text>

      <View style={styles.row}>
        <View style={[styles.card, styles.cardHalf]}>
          <Text style={styles.cardLabel}>Electricity</Text>
          {currentBill ? (
            <>
              <Text style={styles.cardAmount}>₹{currentBill.total_amount.toFixed(2)}</Text>
              <Text style={styles.cardUnits}>{currentBill.units_consumed} units</Text>
              <StatusBadge status={currentBill.status} />
            </>
          ) : (
            <Text style={styles.cardEmpty}>Not added yet</Text>
          )}
        </View>

        <View style={[styles.card, styles.cardHalf]}>
          <Text style={styles.cardLabel}>Rent</Text>
          {currentRent ? (
            <>
              <Text style={styles.cardAmount}>₹{currentRent.amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.cardUnits}>Due {formatDate(currentRent.due_date)}</Text>
              <StatusBadge status={currentRent.status} />
            </>
          ) : (
            <Text style={styles.cardEmpty}>Not added yet</Text>
          )}
        </View>
      </View>

      {recentItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentItems.map(item => (
            <View key={`${item.type}-${item.id}`} style={styles.activityCard}>
              <View style={styles.activityLeft}>
                <Text style={styles.activityType}>
                  {item.type === 'bill' ? 'Electricity' : 'Rent'}
                </Text>
                <Text style={styles.activityDate}>
                  {MONTHS[item.month - 1]} {item.year} · Due {formatDate(item.due_date)}
                </Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={styles.activityAmount}>
                  ₹{item.type === 'bill'
                    ? (item as Bill).total_amount.toFixed(2)
                    : (item as Rent).amount.toLocaleString('en-IN')}
                </Text>
                <StatusBadge status={item.status} small />
              </View>
            </View>
          ))}
        </>
      )}

      {(bills.length > 0 || rents.length > 0) && (
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsTitle}>✦ AI Insights</Text>
            <TouchableOpacity
              onPress={() => refreshInsights(bills, rents)}
              disabled={loadingInsights}
              style={styles.insightsRefreshBtn}
            >
              <Text style={styles.insightsRefreshText}>{loadingInsights ? '...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
          {loadingInsights && (
            <View style={styles.insightsLoading}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.insightsLoadingText}>Analyzing your expenses...</Text>
            </View>
          )}
          {!loadingInsights && insights && (
            <Text style={styles.insightsText}>{insights}</Text>
          )}
          {!loadingInsights && !insights && (
            <Text style={styles.insightsEmpty}>Tap Refresh to get AI-powered spending insights.</Text>
          )}
        </View>
      )}

      {bills.length === 0 && rents.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyText}>
            Add electricity bills and rent payments from the tabs below.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatusBadge({ status, small }: { status: 'paid' | 'unpaid'; small?: boolean }) {
  return (
    <View style={[styles.badge, status === 'paid' ? styles.badgePaid : styles.badgeUnpaid, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, status === 'paid' ? styles.badgeTextPaid : styles.badgeTextUnpaid, small && styles.badgeTextSmall]}>
        {status === 'paid' ? 'PAID' : 'UNPAID'}
      </Text>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[2])} ${MONTHS[parseInt(parts[1]) - 1]}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingBottom: 40, paddingTop: 20 },
  header: { marginBottom: 20, marginTop: 12 },
  headerSub: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#111827' },
  alertCard: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  alertText: { fontSize: 14, color: '#92400E', fontWeight: '600' },
  alertAmount: { fontSize: 16, color: '#92400E', fontWeight: '700' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHalf: { flex: 1 },
  cardLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  cardAmount: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 2 },
  cardUnits: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  cardEmpty: { fontSize: 14, color: '#D1D5DB', marginTop: 8, fontStyle: 'italic' },
  activityCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  activityLeft: { flex: 1 },
  activityType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  activityDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeUnpaid: { backgroundColor: '#FEE2E2' },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2, marginTop: 0 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  badgeTextPaid: { color: '#16A34A' },
  badgeTextUnpaid: { color: '#DC2626' },
  badgeTextSmall: { fontSize: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#D1D5DB', textAlign: 'center', lineHeight: 20 },
  insightsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: '#6366F1',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  insightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  insightsTitle: { fontSize: 13, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.8 },
  insightsRefreshBtn: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  insightsRefreshText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
  insightsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  insightsLoadingText: { fontSize: 13, color: '#6B7280' },
  insightsText: { fontSize: 14, color: '#374151', lineHeight: 21 },
  insightsEmpty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
});
