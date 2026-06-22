import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import {
  getBills, getRentPayments, getSettings, updateBillStatus, updateRentStatus,
  type Bill, type Rent, type AppSettings,
} from '@/lib/database';
import { generateDashboardInsights, hasOpenAIKey } from '@/lib/openai';
import { useTheme, type Theme } from '@/lib/theme';
import { logError } from '@/lib/logger';
import { safeNumber } from '@/lib/dates';
import { Pill } from '@/components/ui/pill';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEFAULT_APARTMENT = 'My Apartment';

function displayApartment(name: string | undefined | null): string {
  const n = (name ?? '').trim();
  if (!n || n === DEFAULT_APARTMENT) return 'My Home';
  return n;
}

export default function DashboardScreen() {
  const { top } = useSafeAreaInsets();
  const t = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [rents, setRents] = useState<Rent[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ apartment_name: DEFAULT_APARTMENT, onboarding_done: 1 });
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const [b, r, s] = await Promise.all([getBills(), getRentPayments(), getSettings()]);
      if (signal?.cancelled) return;
      setBills(b);
      setRents(r);
      setSettings(s);
    } catch (err) {
      logError('Dashboard.load', 'Failed to load dashboard data', err);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function refreshInsights(billsData: Bill[], rentsData: Rent[]) {
    if (billsData.length === 0 && rentsData.length === 0) return;
    setLoadingInsights(true);
    setInsights(null);
    try {
      const text = await generateDashboardInsights({ bills: billsData, rents: rentsData });
      setInsights(text);
    } catch (err) {
      logError('Dashboard.refreshInsights', 'OpenAI call failed', err);
      setInsights('Could not load insights right now.');
    } finally {
      setLoadingInsights(false);
    }
  }

  async function quickPayBill(bill: Bill) {
    await updateBillStatus(bill.id, 'paid');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    load();
  }

  async function quickPayRent(rent: Rent) {
    await updateRentStatus(rent.id, 'paid');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    load();
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const unpaidBills = bills.filter(b => b.status === 'unpaid');
  const unpaidRents = rents.filter(r => r.status === 'unpaid');
  const totalPendingCount = unpaidBills.length + unpaidRents.length;
  const totalPendingAmount =
    unpaidBills.reduce((s, b) => s + safeNumber(b.total_amount), 0) +
    unpaidRents.reduce((s, r) => s + safeNumber(r.amount), 0);

  const currentBill = bills.find(b => b.month === currentMonth && b.year === currentYear);
  const currentRent = rents.find(r => r.month === currentMonth && r.year === currentYear);

  const ytdBillsPaid = bills.filter(b => b.year === currentYear && b.status === 'paid');
  const ytdRentsPaid = rents.filter(r => r.year === currentYear && r.status === 'paid');
  const ytdTotal =
    ytdBillsPaid.reduce((s, b) => s + safeNumber(b.total_amount), 0) +
    ytdRentsPaid.reduce((s, r) => s + safeNumber(r.amount), 0);

  const recentItems = [
    ...bills.map(b => ({ ...b, type: 'bill' as const })),
    ...rents.map(r => ({ ...r, type: 'rent' as const })),
  ]
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
    .slice(0, 5);

  const isEmpty = bills.length === 0 && rents.length === 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerSub, { color: t.textSub }]}>Welcome back</Text>
          <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
            {displayApartment(settings.apartment_name)}
          </Text>
        </View>
        {ytdTotal > 0 && (
          <View style={[styles.ytdPill, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
            <Text style={[styles.ytdPillLabel, { color: t.textMuted }]}>YTD</Text>
            <Text style={[styles.ytdPillAmount, { color: t.text }]}>₹{ytdTotal.toLocaleString('en-IN')}</Text>
          </View>
        )}
      </View>

      {totalPendingCount > 0 && (
        <View style={[styles.alertCard, { backgroundColor: t.warningLight, borderLeftColor: t.warning }]}>
          <Text style={[styles.alertText, { color: t.warningText }]}>
            {totalPendingCount} pending payment{totalPendingCount > 1 ? 's' : ''}
          </Text>
          <Text style={[styles.alertAmount, { color: t.warningText }]}>
            ₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      {isEmpty ? (
        <View style={{ paddingTop: 24 }}>
          <EmptyState
            icon="house.fill"
            title="Welcome to Home Manager"
            description="Start by adding your electricity bills and rent payments from the tabs below. Your monthly snapshot will appear here."
          />
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: t.textSub }]}>
            This Month — {MONTHS[currentMonth - 1]} {currentYear}
          </Text>

          <View style={styles.row}>
            <Card style={styles.cardHalf}>
              <Text style={[styles.cardLabel, { color: t.textSub }]}>Electricity</Text>
              {currentBill ? (
                <>
                  <Text style={[styles.cardAmount, { color: t.text }]}>₹{currentBill.total_amount.toFixed(2)}</Text>
                  <Text style={[styles.cardUnits, { color: t.textMuted }]}>{currentBill.units_consumed} units</Text>
                  <Pill
                    label={currentBill.status === 'paid' ? 'PAID' : 'UNPAID'}
                    variant={currentBill.status === 'paid' ? 'success' : 'danger'}
                    style={{ marginTop: 6 }}
                  />
                  {currentBill.status === 'unpaid' && (
                    <PrimaryButton
                      label="Pay Now"
                      onPress={() => quickPayBill(currentBill)}
                      size="md"
                      style={{ marginTop: 12 }}
                    />
                  )}
                </>
              ) : (
                <Text style={[styles.cardEmpty, { color: t.textPlaceholder }]}>Not added yet</Text>
              )}
            </Card>

            <Card style={styles.cardHalf}>
              <Text style={[styles.cardLabel, { color: t.textSub }]}>Rent</Text>
              {currentRent ? (
                <>
                  <Text style={[styles.cardAmount, { color: t.text }]}>₹{currentRent.amount.toLocaleString('en-IN')}</Text>
                  <Pill
                    label={currentRent.status === 'paid' ? 'PAID' : 'UNPAID'}
                    variant={currentRent.status === 'paid' ? 'success' : 'danger'}
                    style={{ marginTop: 6 }}
                  />
                  {currentRent.status === 'unpaid' && (
                    <PrimaryButton
                      label="Pay Now"
                      onPress={() => quickPayRent(currentRent)}
                      size="md"
                      style={{ marginTop: 12 }}
                    />
                  )}
                </>
              ) : (
                <Text style={[styles.cardEmpty, { color: t.textPlaceholder }]}>Not added yet</Text>
              )}
            </Card>
          </View>

          {recentItems.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: t.textSub }]}>Recent Activity</Text>
              {recentItems.map(item => (
                <Card key={`${item.type}-${item.id}`} style={styles.activityCard}>
                  <View style={styles.activityLeft}>
                    <View style={styles.activityHeading}>
                      <IconSymbol
                        name={item.type === 'bill' ? 'bolt.fill' : 'house.fill'}
                        size={16}
                        color={t.textSub}
                      />
                      <Text style={[styles.activityType, { color: t.text }]}>
                        {item.type === 'bill' ? 'Electricity' : 'Rent'}
                      </Text>
                    </View>
                    <Text style={[styles.activityDate, { color: t.textMuted }]}>{MONTHS[item.month - 1]} {item.year}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={[styles.activityAmount, { color: t.text }]}>
                      ₹{item.type === 'bill'
                        ? (item as Bill).total_amount.toFixed(2)
                        : (item as Rent).amount.toLocaleString('en-IN')}
                    </Text>
                    <Pill
                      label={item.status === 'paid' ? 'PAID' : 'UNPAID'}
                      variant={item.status === 'paid' ? 'success' : 'danger'}
                      size="sm"
                    />
                  </View>
                </Card>
              ))}
            </>
          )}

          {hasOpenAIKey() && (
            <InsightsCard
              t={t}
              insights={insights}
              loading={loadingInsights}
              onRefresh={() => refreshInsights(bills, rents)}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function InsightsCard({
  t, insights, loading, onRefresh,
}: {
  t: Theme;
  insights: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card style={[styles.insightsCard, { borderLeftColor: t.primary }]}>
      <View style={styles.insightsHeader}>
        <View style={styles.insightsTitleRow}>
          <IconSymbol name="sparkles" size={14} color={t.primary} />
          <Text style={[styles.insightsTitle, { color: t.primary }]}>AI Insights</Text>
        </View>
        <Pressable
          onPress={onRefresh}
          disabled={loading}
          hitSlop={8}
          style={({ pressed }) => [
            styles.insightsRefreshBtn,
            { backgroundColor: t.primaryLight },
            pressed && { opacity: 0.7 },
            loading && { opacity: 0.5 },
          ]}
        >
          <Text style={[styles.insightsRefreshText, { color: t.primaryText }]}>{loading ? '...' : 'Refresh'}</Text>
        </Pressable>
      </View>
      {loading && (
        <View style={styles.insightsLoading}>
          <ActivityIndicator size="small" color={t.primary} />
          <Text style={[styles.insightsLoadingText, { color: t.textSub }]}>Analyzing your expenses...</Text>
        </View>
      )}
      {!loading && insights && <Text style={[styles.insightsText, { color: t.text }]}>{insights}</Text>}
      {!loading && !insights && (
        <Text style={[styles.insightsEmpty, { color: t.textMuted }]}>Tap Refresh to get AI-powered spending insights.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, marginTop: 8, gap: 12,
  },
  headerSub: { fontSize: 14, lineHeight: 18, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  ytdPill: {
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'flex-end', borderWidth: 1,
  },
  ytdPillLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 12 },
  ytdPillAmount: { fontSize: 14, fontWeight: '700', lineHeight: 18, marginTop: 2 },
  alertCard: {
    borderRadius: 12, padding: 16, marginBottom: 20,
    borderLeftWidth: 4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  alertText: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  alertAmount: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 12, lineHeight: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  cardHalf: { flex: 1 },
  cardLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, lineHeight: 14 },
  cardAmount: { fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 2 },
  cardUnits: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  cardEmpty: { fontSize: 14, lineHeight: 20, marginTop: 8, fontStyle: 'italic' },
  activityCard: {
    marginBottom: 8, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  activityLeft: { flex: 1 },
  activityHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityType: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  activityDate: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  activityRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityAmount: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  insightsCard: {
    borderLeftWidth: 4, marginBottom: 20,
  },
  insightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  insightsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightsTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 16 },
  insightsRefreshBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  insightsRefreshText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  insightsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  insightsLoadingText: { fontSize: 13, lineHeight: 18 },
  insightsText: { fontSize: 14, lineHeight: 21 },
  insightsEmpty: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
});
