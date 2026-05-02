import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBills, getRentPayments, type Bill, type Rent } from '@/lib/database';
import { useTheme } from '@/lib/theme';
import { logError } from '@/lib/logger';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHART_HEIGHT = 160;
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 64;

type Tab = 'electricity' | 'rent';

interface BarItem {
  value: number;
  label: string;
  color: string;
}

function SimpleBarChart({ data, height = CHART_HEIGHT, guideColor }: { data: BarItem[]; height?: number; guideColor: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.max(14, Math.floor((CHART_W - 32) / data.length) - 6);

  return (
    <View style={{ width: CHART_W }}>
      <View style={[bStyles.chartArea, { height }]}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <View key={f} style={[bStyles.guideLine, { bottom: f * height, backgroundColor: guideColor }]} />
        ))}
        <View style={bStyles.barsRow}>
          {data.map((item, i) => {
            const barH = Math.max(4, (item.value / max) * height);
            return (
              <View key={i} style={[bStyles.barWrap, { width: barWidth }]}>
                <View style={[bStyles.bar, { height: barH, backgroundColor: item.color, width: barWidth }]} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={bStyles.labelsRow}>
        {data.map((item, i) => (
          <View key={i} style={[bStyles.labelWrap, { width: barWidth }]}>
            <Text style={[bStyles.labelText, { color: guideColor }]} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  chartArea: { position: 'relative', justifyContent: 'flex-end' },
  guideLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 2 },
  barWrap: { alignItems: 'center' },
  bar: { borderRadius: 4 },
  labelsRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  labelWrap: { alignItems: 'center' },
  labelText: { fontSize: 9, fontWeight: '500' },
});

export default function AnalyticsScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const t = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [rents, setRents] = useState<Rent[]>([]);
  const [tab, setTab] = useState<Tab>('electricity');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const [b, r] = await Promise.all([getBills(db), getRentPayments(db)]);
      if (signal?.cancelled) return;
      setBills(b);
      setRents(r);
    } catch (err) {
      logError('Analytics.load', 'Failed to load analytics data', err);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]));

  const allYears = Array.from(new Set([
    ...bills.map(b => b.year),
    ...rents.map(r => r.year),
    now.getFullYear(),
  ])).sort((a, b) => b - a);

  const yearBills = bills.filter(b => b.year === selectedYear).sort((a, b) => a.month - b.month);
  const yearRents = rents.filter(r => r.year === selectedYear).sort((a, b) => a.month - b.month);

  const billBarData: BarItem[] = yearBills.map(b => ({
    value: Math.round(b.total_amount),
    label: MONTHS_SHORT[b.month - 1],
    color: b.status === 'paid' ? t.chartBillPaid : t.chartBillUnpaid,
  }));

  const unitsBarData: BarItem[] = yearBills.map(b => ({
    value: Math.round(b.units_consumed),
    label: MONTHS_SHORT[b.month - 1],
    color: t.chartUnits,
  }));

  const rentBarData: BarItem[] = yearRents.map(r => ({
    value: Math.round(r.amount),
    label: MONTHS_SHORT[r.month - 1],
    color: r.status === 'paid' ? t.chartRentPaid : t.chartRentUnpaid,
  }));

  const paidBills = yearBills.filter(b => b.status === 'paid');
  const unpaidBills = yearBills.filter(b => b.status === 'unpaid');
  const avgBillAmount = paidBills.length ? paidBills.reduce((s, b) => s + b.total_amount, 0) / paidBills.length : 0;
  const avgUnits = paidBills.length ? paidBills.reduce((s, b) => s + b.units_consumed, 0) / paidBills.length : 0;
  const maxBill = yearBills.length ? Math.max(...yearBills.map(b => b.total_amount)) : 0;
  const minBill = yearBills.length ? Math.min(...yearBills.map(b => b.total_amount)) : 0;
  const totalBillPaid = paidBills.reduce((s, b) => s + b.total_amount, 0);

  const paidRents = yearRents.filter(r => r.status === 'paid');
  const totalRentPaid = paidRents.reduce((s, r) => s + r.amount, 0);

  const ytdBills = bills.filter(b => b.year === selectedYear && b.status === 'paid');
  const ytdRents = rents.filter(r => r.year === selectedYear && r.status === 'paid');
  const ytdTotal = ytdBills.reduce((s, b) => s + b.total_amount, 0) + ytdRents.reduce((s, r) => s + r.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.headerBar, { paddingTop: top + 16, backgroundColor: t.bg }]}>
        <Text style={[styles.screenTitle, { color: t.text }]}>Analytics</Text>

        {/* Year picker */}
        <View style={styles.yearRow}>
          <TouchableOpacity
            style={styles.yearArrow}
            onPress={() => {
              const idx = allYears.indexOf(selectedYear);
              if (idx < allYears.length - 1) setSelectedYear(allYears[idx + 1]);
            }}
          >
            <Text style={[styles.yearArrowText, { color: t.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.yearLabel, { color: t.text }]}>{selectedYear}</Text>
          <TouchableOpacity
            style={styles.yearArrow}
            onPress={() => {
              const idx = allYears.indexOf(selectedYear);
              if (idx > 0) setSelectedYear(allYears[idx - 1]);
            }}
          >
            <Text style={[styles.yearArrowText, { color: t.primary }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={[styles.ytdCard, { backgroundColor: t.primary }]}>
          <Text style={styles.ytdLabel}>Total Paid {selectedYear}</Text>
          <Text style={styles.ytdAmount}>₹{ytdTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          <View style={styles.ytdRow}>
            <View style={styles.ytdItem}>
              <Text style={styles.ytdItemLabel}>Electricity</Text>
              <Text style={styles.ytdItemValue}>₹{ytdBills.reduce((s, b) => s + b.total_amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.ytdDivider} />
            <View style={styles.ytdItem}>
              <Text style={styles.ytdItemLabel}>Rent</Text>
              <Text style={styles.ytdItemValue}>₹{ytdRents.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.tabRow, { backgroundColor: t.border }]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'electricity' && [styles.tabBtnActive, { backgroundColor: t.card }]]}
            onPress={() => setTab('electricity')}
          >
            <Text style={[styles.tabBtnText, { color: t.textSub }, tab === 'electricity' && { color: t.primary }]}>Electricity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'rent' && [styles.tabBtnActive, { backgroundColor: t.card }]]}
            onPress={() => setTab('rent')}
          >
            <Text style={[styles.tabBtnText, { color: t.textSub }, tab === 'rent' && { color: t.primary }]}>Rent</Text>
          </TouchableOpacity>
        </View>

        {tab === 'electricity' ? (
          <>
            <View style={[styles.chartCard, { backgroundColor: t.card }]}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Bill Amount (₹)</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>{selectedYear} · solid = paid, light = unpaid</Text>
              {billBarData.length > 0
                ? <SimpleBarChart data={billBarData} guideColor={t.border} />
                : <EmptyChart message="No electricity bills for this year" textColor={t.textPlaceholder} />}
            </View>

            <View style={[styles.chartCard, { backgroundColor: t.card }]}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Units Consumed</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>Monthly electricity usage</Text>
              {unitsBarData.length > 0
                ? <SimpleBarChart data={unitsBarData} guideColor={t.border} />
                : <EmptyChart message="No data for this year" textColor={t.textPlaceholder} />}
            </View>

            {yearBills.length > 0 && (
              <View style={styles.statsGrid}>
                <StatCard label="Avg Bill" value={`₹${avgBillAmount.toFixed(0)}`} color={t.chartBillPaid} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Avg Units" value={`${avgUnits.toFixed(0)} u`} color={t.chartUnits} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Highest" value={`₹${maxBill.toFixed(0)}`} color={t.chartAccentAmber} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Lowest" value={`₹${minBill.toFixed(0)}`} color={t.chartAccentBlue} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Total Paid" value={`₹${totalBillPaid.toLocaleString('en-IN')}`} color={t.chartAccentGreen} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Unpaid" value={String(unpaidBills.length)} color={unpaidBills.length > 0 ? t.chartAccentRed : t.textMuted} bg={t.card} labelColor={t.textMuted} />
              </View>
            )}
          </>
        ) : (
          <>
            <View style={[styles.chartCard, { backgroundColor: t.card }]}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Rent Amount (₹)</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>{selectedYear} · solid = paid, light = unpaid</Text>
              {rentBarData.length > 0
                ? <SimpleBarChart data={rentBarData} guideColor={t.border} />
                : <EmptyChart message="No rent records for this year" textColor={t.textPlaceholder} />}
            </View>

            {yearRents.length > 0 && (
              <View style={styles.statsGrid}>
                <StatCard label="Total Paid" value={`₹${totalRentPaid.toLocaleString('en-IN')}`} color={t.chartRentPaid} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Months Paid" value={String(paidRents.length)} color={t.chartAccentGreen} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Unpaid" value={String(yearRents.filter(r => r.status === 'unpaid').length)} color={yearRents.filter(r => r.status === 'unpaid').length > 0 ? t.chartAccentRed : t.textMuted} bg={t.card} labelColor={t.textMuted} />
                <StatCard label="Avg Rent" value={yearRents.length ? `₹${(yearRents.reduce((s, r) => s + r.amount, 0) / yearRents.length).toFixed(0)}` : '–'} color={t.chartBillPaid} bg={t.card} labelColor={t.textMuted} />
              </View>
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color, bg, labelColor }: { label: string; value: string; color: string; bg: string; labelColor: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: bg }]}>
      <Text style={[styles.statCardLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
    </View>
  );
}

function EmptyChart({ message, textColor }: { message: string; textColor: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={[styles.emptyChartText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yearArrow: { padding: 6 },
  yearArrowText: { fontSize: 22, fontWeight: '300' },
  yearLabel: { fontSize: 16, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 60 },

  ytdCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  ytdLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  ytdAmount: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 16 },
  ytdRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  ytdItem: { flex: 1, padding: 12, alignItems: 'center' },
  ytdDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  ytdItemLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 },
  ytdItemValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  tabRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 14, fontWeight: '600' },

  chartCard: {
    borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden',
  },
  chartTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  chartSub: { fontSize: 12, marginBottom: 14 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    borderRadius: 12, padding: 14,
    borderLeftWidth: 4, flex: 1, minWidth: '44%',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statCardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  statCardValue: { fontSize: 18, fontWeight: '800' },

  emptyChart: { height: 120, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { fontSize: 13, fontStyle: 'italic' },
});
