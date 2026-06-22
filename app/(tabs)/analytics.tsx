import { useCallback, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';

import { getBills, getRentPayments, type Bill, type Rent } from '@/lib/database';
import { useTheme, type Theme } from '@/lib/theme';
import { logError } from '@/lib/logger';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Tab = 'electricity' | 'rent';

const TABS = [
  { value: 'electricity' as const, label: 'Electricity' },
  { value: 'rent' as const, label: 'Rent' },
];

export default function AnalyticsScreen() {
  const t = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [rents, setRents] = useState<Rent[]>([]);
  const [tab, setTab] = useState<Tab>('electricity');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const [b, r] = await Promise.all([getBills(), getRentPayments()]);
      if (signal?.cancelled) return;
      setBills(b);
      setRents(r);
    } catch (err) {
      logError('Analytics.load', 'Failed to load analytics data', err);
    }
  }, []);

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

  const billChartData = yearBills.map(b => ({
    value: Math.round(b.total_amount),
    label: MONTHS_SHORT[b.month - 1],
    frontColor: b.status === 'paid' ? t.chartBillPaid : t.chartBillUnpaid,
  }));

  const unitsChartData = yearBills.map(b => ({
    value: Math.round(b.units_consumed),
    label: MONTHS_SHORT[b.month - 1],
    frontColor: t.chartUnits,
  }));

  const rentChartData = yearRents.map(r => ({
    value: Math.round(r.amount),
    label: MONTHS_SHORT[r.month - 1],
    frontColor: r.status === 'paid' ? t.chartRentPaid : t.chartRentUnpaid,
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

  const yearIdx = allYears.indexOf(selectedYear);
  const canPrevYear = yearIdx < allYears.length - 1;
  const canNextYear = yearIdx > 0;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScreenHeader
        title="Analytics"
        trailing={
          <View style={styles.yearRow}>
            <Pressable
              onPress={() => canPrevYear && setSelectedYear(allYears[yearIdx + 1])}
              disabled={!canPrevYear}
              hitSlop={8}
              style={({ pressed }) => [styles.yearArrow, pressed && { opacity: 0.5 }]}
            >
              <Text style={[styles.yearArrowText, { color: canPrevYear ? t.primary : t.textPlaceholder }]}>‹</Text>
            </Pressable>
            <Text style={[styles.yearLabel, { color: t.text }]}>{selectedYear}</Text>
            <Pressable
              onPress={() => canNextYear && setSelectedYear(allYears[yearIdx - 1])}
              disabled={!canNextYear}
              hitSlop={8}
              style={({ pressed }) => [styles.yearArrow, pressed && { opacity: 0.5 }]}
            >
              <Text style={[styles.yearArrowText, { color: canNextYear ? t.primary : t.textPlaceholder }]}>›</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={[styles.ytdCard, { backgroundColor: t.primary }]}>
          <Text style={styles.ytdLabel}>Total Paid {selectedYear}</Text>
          <Text style={styles.ytdAmount}>₹{ytdTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          <View style={styles.ytdInline}>
            <Text style={styles.ytdInlineItem}>
              Electricity ₹{ytdBills.reduce((s, b) => s + b.total_amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.ytdInlineDot}>·</Text>
            <Text style={styles.ytdInlineItem}>
              Rent ₹{ytdRents.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </Card>

        <View style={{ marginBottom: 16 }}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>

        {tab === 'electricity' ? (
          <>
            <Card style={styles.chartCard}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Bill Amount (₹)</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>{selectedYear} · solid = paid, light = unpaid</Text>
              {billChartData.length > 0
                ? <ChartWrap><BarChart {...defaultBarProps(t)} data={billChartData} /></ChartWrap>
                : <EmptyChart message="No electricity bills for this year" textColor={t.textPlaceholder} />}
            </Card>

            <Card style={styles.chartCard}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Units Consumed</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>Monthly electricity usage</Text>
              {unitsChartData.length > 0
                ? <ChartWrap><BarChart {...defaultBarProps(t)} data={unitsChartData} yAxisLabelSuffix=" u" /></ChartWrap>
                : <EmptyChart message="No data for this year" textColor={t.textPlaceholder} />}
            </Card>

            {yearBills.length > 0 && (
              <View style={styles.statsGrid}>
                <StatCard label="Avg Bill" value={`₹${avgBillAmount.toFixed(0)}`} accent={t.chartBillPaid} t={t} />
                <StatCard label="Avg Units" value={`${avgUnits.toFixed(0)} u`} accent={t.chartUnitsText} t={t} />
                <StatCard label="Highest" value={`₹${maxBill.toFixed(0)}`} accent={t.chartAccentAmberText} t={t} />
                <StatCard label="Lowest" value={`₹${minBill.toFixed(0)}`} accent={t.chartAccentBlueText} t={t} />
                <StatCard label="Total Paid" value={`₹${totalBillPaid.toLocaleString('en-IN')}`} accent={t.chartAccentGreenText} t={t} />
                <StatCard
                  label="Unpaid"
                  value={String(unpaidBills.length)}
                  accent={unpaidBills.length > 0 ? t.dangerText : t.textMuted}
                  t={t}
                />
              </View>
            )}
          </>
        ) : (
          <>
            <Card style={styles.chartCard}>
              <Text style={[styles.chartTitle, { color: t.text }]}>Rent Amount (₹)</Text>
              <Text style={[styles.chartSub, { color: t.textMuted }]}>{selectedYear} · solid = paid, light = unpaid</Text>
              {rentChartData.length > 0
                ? <ChartWrap><BarChart {...defaultBarProps(t)} data={rentChartData} /></ChartWrap>
                : <EmptyChart message="No rent records for this year" textColor={t.textPlaceholder} />}
            </Card>

            {yearRents.length > 0 && (
              <View style={styles.statsGrid}>
                <StatCard label="Total Paid" value={`₹${totalRentPaid.toLocaleString('en-IN')}`} accent={t.chartAccentBlueText} t={t} />
                <StatCard label="Months Paid" value={String(paidRents.length)} accent={t.chartAccentGreenText} t={t} />
                <StatCard
                  label="Unpaid"
                  value={String(yearRents.filter(r => r.status === 'unpaid').length)}
                  accent={yearRents.filter(r => r.status === 'unpaid').length > 0 ? t.dangerText : t.textMuted}
                  t={t}
                />
                <StatCard
                  label="Avg Rent"
                  value={yearRents.length ? `₹${(yearRents.reduce((s, r) => s + r.amount, 0) / yearRents.length).toFixed(0)}` : '–'}
                  accent={t.chartBillPaid}
                  t={t}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function defaultBarProps(t: Theme) {
  return {
    height: 180,
    barWidth: 18,
    spacing: 12,
    initialSpacing: 12,
    barBorderRadius: 4,
    yAxisColor: 'transparent',
    xAxisColor: t.border,
    yAxisTextStyle: { color: t.textMuted, fontSize: 10 },
    xAxisLabelTextStyle: { color: t.textMuted, fontSize: 10 },
    rulesColor: t.border,
    rulesType: 'dashed' as const,
    noOfSections: 4,
    isAnimated: true,
    animationDuration: 600,
  };
}

function ChartWrap({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
    >
      {children}
    </ScrollView>
  );
}

function StatCard({ label, value, accent, t }: { label: string; value: string; accent: string; t: Theme }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: accent, backgroundColor: t.card, shadowColor: t.shadow }]}>
      <Text style={[styles.statCardLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[styles.statCardValue, { color: accent }]}>{value}</Text>
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
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yearArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  yearArrowText: { fontSize: 22, fontWeight: '300', lineHeight: 26 },
  yearLabel: { fontSize: 16, fontWeight: '700', lineHeight: 20, minWidth: 50, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 60 },
  ytdCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  ytdLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, lineHeight: 14,
  },
  ytdAmount: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', lineHeight: 34, marginBottom: 8 },
  ytdInline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ytdInlineItem: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600', lineHeight: 18 },
  ytdInlineDot: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  chartCard: { marginBottom: 14 },
  chartTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 2 },
  chartSub: { fontSize: 12, lineHeight: 16, marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    borderRadius: 12, padding: 14,
    borderLeftWidth: 4, flex: 1, minWidth: '44%',
    shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statCardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, lineHeight: 14 },
  statCardValue: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  emptyChart: { height: 120, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
});
