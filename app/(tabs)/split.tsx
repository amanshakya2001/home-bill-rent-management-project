import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { generateBillMessage } from '@/lib/openai';
import {
  addSplitRecord, getSplitRecords, deleteSplitRecord, type SplitRecord,
} from '@/lib/database';
import { useTheme, type Theme } from '@/lib/theme';
import { logError } from '@/lib/logger';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function prevMonth(m: number, y: number) { return m === 1 ? { m: 12, y: y - 1 } : { m: m - 1, y }; }
function nextMonth(m: number, y: number) { return m === 12 ? { m: 1, y: y + 1 } : { m: m + 1, y }; }
function clampDayInput(input: string): string {
  const digits = input.replace(/[^0-9]/g, '').slice(0, 2);
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (n > 31) return '31';
  return digits;
}

type ActiveTab = 'calculator' | 'history';

export default function SplitScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const now = new Date();
  const [activeTab, setActiveTab] = useState<ActiveTab>('calculator');
  const [splitHistory, setSplitHistory] = useState<SplitRecord[]>([]);

  const [fromDay, setFromDay] = useState('1');
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toDay, setToDay] = useState(String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());
  const [totalAmount, setTotalAmount] = useState('');
  const [ourUnits, setOurUnits] = useState('');
  const [topFloorUnits, setTopFloorUnits] = useState('');
  const [undergroundUnits, setUndergroundUnits] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState(`Hi all 👋

Here's the electricity bill split for *1 Mar 2026 – 31 Mar 2026*:

📊 *Total bill:* ₹2,700.00
⚡ *Per unit rate:* ₹7.50

*Our Floor:* 145 units → *₹1,087.50*
*Top Floor:* 160 units → *₹1,200.00*
*Underground:* 55 units → *₹412.50*

Please send your share at your earliest. Thanks!`); // DEV
  const [showResult, setShowResult] = useState(true); // DEV
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await getSplitRecords(db);
      if (signal?.cancelled) return;
      setSplitHistory(data);
    } catch (err) {
      logError('Split.load', 'Failed to load split history', err);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]));

  const total = parseFloat(totalAmount || '0');
  const our = parseFloat(ourUnits || '0');
  const topFloor = parseFloat(topFloorUnits || '0');
  const underground = parseFloat(undergroundUnits || '0');
  const totalUnits = our + topFloor + underground;
  const perUnit = totalUnits > 0 ? total / totalUnits : 0;
  const ourAmount = our * perUnit;
  const topAmount = topFloor * perUnit;
  const undergroundAmount = underground * perUnit;
  const canGenerate = total > 0 && totalUnits > 0;

  function buildPeriod() {
    const from = `${parseInt(fromDay)} ${MONTHS_SHORT[fromMonth - 1]} ${fromYear}`;
    const to = `${parseInt(toDay)} ${MONTHS_SHORT[toMonth - 1]} ${toYear}`;
    return `${from} – ${to}`;
  }

  async function handleGenerate() {
    if (!canGenerate) { Alert.alert('Missing data', 'Please enter total amount and at least one unit reading.'); return; }
    const fd = parseInt(fromDay), td = parseInt(toDay);
    if (!fd || fd < 1 || fd > 31 || !td || td < 1 || td > 31) {
      Alert.alert('Invalid dates', 'Please enter valid day values (1–31).'); return;
    }
    setGenerating(true);
    try {
      const data = {
        period: buildPeriod(), totalAmount: total, totalUnits, perUnit,
        ourUnits: our, ourAmount, topFloorUnits: topFloor, topFloorAmount: topAmount,
        undergroundUnits: underground, undergroundAmount,
      };
      const msg = await generateBillMessage(data);
      setGeneratedMessage(msg);
      setCopied(false);
      setShowResult(true);
      await addSplitRecord(db, {
        period: data.period, total_amount: total, total_units: totalUnits, per_unit: perUnit,
        our_units: our, our_amount: ourAmount,
        top_floor_units: topFloor, top_floor_amount: topAmount,
        underground_units: underground, underground_amount: undergroundAmount,
      });
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to generate bill message.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    await Clipboard.setStringAsync(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function deleteHistory(record: SplitRecord) {
    Alert.alert('Delete Split', `Delete split record for ${record.period}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSplitRecord(db, record.id); load(); } },
    ]);
  }

  const TABS = [
    { value: 'calculator' as const, label: 'Calculator' },
    { value: 'history' as const, label: `History${splitHistory.length > 0 ? ` (${splitHistory.length})` : ''}` },
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScreenHeader title="Bill Splitter" />

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <SegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} />
      </View>

      {activeTab === 'calculator' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Billing Period</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>From</Text>
            <DatePicker
              day={fromDay} onDayChange={v => setFromDay(clampDayInput(v))}
              month={fromMonth} year={fromYear}
              onPrev={() => { const p = prevMonth(fromMonth, fromYear); setFromMonth(p.m); setFromYear(p.y); }}
              onNext={() => { const n = nextMonth(fromMonth, fromYear); setFromMonth(n.m); setFromYear(n.y); }}
              theme={t}
            />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>To</Text>
            <DatePicker
              day={toDay} onDayChange={v => setToDay(clampDayInput(v))}
              month={toMonth} year={toYear}
              onPrev={() => { const p = prevMonth(toMonth, toYear); setToMonth(p.m); setToYear(p.y); }}
              onNext={() => { const n = nextMonth(toMonth, toYear); setToMonth(n.m); setToYear(n.y); }}
              theme={t}
            />
            {fromDay && toDay && (
              <View style={[styles.periodPreview, { backgroundColor: t.primaryLight }]}>
                <Text style={[styles.periodPreviewText, { color: t.primaryText }]}>{buildPeriod()}</Text>
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Total Electricity Bill</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Total Amount (₹)</Text>
            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
              value={totalAmount} onChangeText={setTotalAmount}
              keyboardType="decimal-pad" placeholder="e.g. 2700"
              placeholderTextColor={t.textPlaceholder}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Unit Readings</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Our Floor — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={ourUnits} onChangeText={setOurUnits} keyboardType="decimal-pad" placeholder="e.g. 120" placeholderTextColor={t.textPlaceholder} />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Top Floor — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={topFloorUnits} onChangeText={setTopFloorUnits} keyboardType="decimal-pad" placeholder="e.g. 160" placeholderTextColor={t.textPlaceholder} />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Underground — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={undergroundUnits} onChangeText={setUndergroundUnits} keyboardType="decimal-pad" placeholder="e.g. 80" placeholderTextColor={t.textPlaceholder} />
          </Card>

          {totalUnits > 0 && total > 0 && (
            <Card style={styles.card}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Bill Breakdown</Text>
              <View style={[styles.metaRow, { backgroundColor: t.cardAlt }]}>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: t.textMuted }]}>Per Unit Rate</Text>
                  <Text style={[styles.metaValue, { color: t.text }]}>₹{perUnit.toFixed(2)}</Text>
                </View>
                <View style={[styles.metaDivider, { backgroundColor: t.border }]} />
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: t.textMuted }]}>Total Units</Text>
                  <Text style={[styles.metaValue, { color: t.text }]}>{totalUnits.toFixed(0)}</Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: t.border }]} />
              <PartyRow label="Our Floor" units={our} amount={ourAmount} accent={t.chartBillPaid} textColor={t.text} subColor={t.textMuted} />
              <PartyRow label="Top Floor" units={topFloor} amount={topAmount} accent={t.chartAccentBlue} textColor={t.text} subColor={t.textMuted} />
              <PartyRow label="Underground" units={underground} amount={undergroundAmount} accent={t.chartUnits} textColor={t.text} subColor={t.textMuted} />
              <View style={[styles.totalVerify, { borderTopColor: t.border }]}>
                <Text style={[styles.totalVerifyLabel, { color: t.textSub }]}>Total Check</Text>
                <Text style={[
                  styles.totalVerifyValue,
                  Math.abs((ourAmount + topAmount + undergroundAmount) - total) < 1
                    ? { color: t.successText }
                    : { color: t.dangerText },
                ]}>
                  ₹{(ourAmount + topAmount + undergroundAmount).toFixed(2)}
                </Text>
              </View>
            </Card>
          )}

          <PrimaryButton
            label={generating ? 'Generating with AI...' : 'Generate WhatsApp Message'}
            onPress={handleGenerate}
            disabled={!canGenerate || generating}
            loading={generating}
            size="lg"
            style={{ marginBottom: 8 }}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {splitHistory.length === 0 ? (
            <EmptyState
              icon="list.bullet"
              title="No split history yet"
              description="Split records are saved automatically when you generate a WhatsApp message."
            />
          ) : (
            splitHistory.map(record => (
              <Card key={record.id} style={styles.card}>
                <View style={styles.historyCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyPeriod, { color: t.text }]}>{record.period}</Text>
                    <Text style={[styles.historyDate, { color: t.textMuted }]}>
                      Saved {new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteHistory(record)}
                    hitSlop={12}
                    style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
                  >
                    <IconSymbol name="xmark" size={18} color={t.textMuted} />
                  </Pressable>
                </View>

                <View style={[styles.historyMeta, { backgroundColor: t.cardAlt }]}>
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: t.textMuted }]}>Total Bill</Text>
                    <Text style={[styles.historyMetaValue, { color: t.text }]}>₹{record.total_amount.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.historyMetaDivider, { backgroundColor: t.border }]} />
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: t.textMuted }]}>Per Unit</Text>
                    <Text style={[styles.historyMetaValue, { color: t.text }]}>₹{record.per_unit.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.historyMetaDivider, { backgroundColor: t.border }]} />
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: t.textMuted }]}>Total Units</Text>
                    <Text style={[styles.historyMetaValue, { color: t.text }]}>{record.total_units.toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.historyParties}>
                  {record.our_units > 0 && <HistoryParty label="Our Floor" units={record.our_units} amount={record.our_amount} accent={t.chartBillPaid} subColor={t.textMuted} />}
                  {record.top_floor_units > 0 && <HistoryParty label="Top Floor" units={record.top_floor_units} amount={record.top_floor_amount} accent={t.chartAccentBlue} subColor={t.textMuted} />}
                  {record.underground_units > 0 && <HistoryParty label="Underground" units={record.underground_units} amount={record.underground_amount} accent={t.chartUnits} subColor={t.textMuted} />}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showResult} animationType="slide" transparent onRequestClose={() => setShowResult(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: t.overlay }]} onPress={() => setShowResult(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: t.card }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>WhatsApp Message</Text>
              <Pressable
                onPress={() => setShowResult(false)}
                hitSlop={12}
                style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.5 }]}
              >
                <Text style={[styles.modalCloseText, { color: t.textMuted }]}>✕</Text>
              </Pressable>
            </View>
            <Text style={[styles.editHint, { color: t.textMuted }]}>You can edit the message before copying.</Text>
            <TextInput
              value={generatedMessage}
              onChangeText={setGeneratedMessage}
              multiline
              style={[styles.messageBox, { backgroundColor: t.cardAlt, borderColor: t.border, color: t.text }]}
              textAlignVertical="top"
            />
            <PrimaryButton
              label={copied ? '✓ Copied to Clipboard' : 'Copy Message'}
              onPress={copyToClipboard}
              variant={copied ? 'success' : 'primary'}
              size="lg"
              style={{ marginBottom: 10 }}
            />
            <Pressable
              onPress={() => { setShowResult(false); handleGenerate(); }}
              hitSlop={8}
              style={({ pressed }) => [styles.regenerateBtn, pressed && { opacity: 0.5 }]}
            >
              <Text style={[styles.regenerateBtnText, { color: t.textSub }]}>Regenerate</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DatePicker({ day, onDayChange, month, year, onPrev, onNext, theme: t }: {
  day: string; onDayChange: (v: string) => void;
  month: number; year: number; onPrev: () => void; onNext: () => void;
  theme: Theme;
}) {
  return (
    <View style={styles.datePicker}>
      <TextInput
        style={[styles.dayInput, { borderColor: t.border, color: t.primary, backgroundColor: t.inputBg }]}
        value={day} onChangeText={onDayChange}
        keyboardType="number-pad" maxLength={2} placeholder="DD"
        placeholderTextColor={t.textPlaceholder}
      />
      <Text style={[styles.dateSep, { color: t.border }]}>/</Text>
      <View style={[styles.monthPicker, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.arrowBtn}>
          <Text style={[styles.arrowText, { color: t.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.dateMonthText, { color: t.text }]}>{MONTHS_SHORT[month - 1]} {year}</Text>
        <Pressable onPress={onNext} hitSlop={8} style={styles.arrowBtn}>
          <Text style={[styles.arrowText, { color: t.primary }]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PartyRow({
  label, units, amount, accent, textColor, subColor,
}: { label: string; units: number; amount: number; accent: string; textColor: string; subColor: string }) {
  if (units <= 0) return null;
  return (
    <View style={styles.partyRow}>
      <Text style={[styles.partyLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.partyUnits, { color: subColor }]}>{units.toFixed(0)} units</Text>
      <Text style={[styles.partyAmount, { color: accent }]}>₹{amount.toFixed(2)}</Text>
    </View>
  );
}

function HistoryParty({
  label, units, amount, accent, subColor,
}: { label: string; units: number; amount: number; accent: string; subColor: string }) {
  return (
    <View style={[styles.historyPartyChip, { borderColor: accent + '60', backgroundColor: accent + '14' }]}>
      <Text style={[styles.historyPartyLabel, { color: accent }]}>{label}</Text>
      <Text style={[styles.historyPartyAmount, { color: accent }]}>₹{amount.toFixed(2)}</Text>
      <Text style={[styles.historyPartyUnits, { color: subColor }]}>{units.toFixed(0)} u</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  card: { marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 22, minHeight: 48 },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayInput: {
    borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 18,
    fontWeight: '700', textAlign: 'center', width: 60, minHeight: 48,
  },
  dateSep: { fontSize: 20, fontWeight: '300', lineHeight: 24 },
  monthPicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 4,
    minHeight: 48,
  },
  arrowBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 24, fontWeight: '300', lineHeight: 28 },
  dateMonthText: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  periodPreview: { marginTop: 12, borderRadius: 10, padding: 10, alignItems: 'center' },
  periodPreviewText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  metaRow: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  metaItem: { flex: 1, alignItems: 'center', padding: 12 },
  metaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, lineHeight: 14 },
  metaValue: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  metaDivider: { width: 1 },
  divider: { height: 1, marginVertical: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  partyLabel: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  partyUnits: { fontSize: 13, lineHeight: 18, marginRight: 8 },
  partyAmount: { fontSize: 15, fontWeight: '700', lineHeight: 20, minWidth: 80, textAlign: 'right' },
  totalVerify: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  totalVerifyLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  totalVerifyValue: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  historyPeriod: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  historyDate: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  historyMeta: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  historyMetaItem: { flex: 1, padding: 10, alignItems: 'center' },
  historyMetaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2, lineHeight: 12 },
  historyMetaValue: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  historyMetaDivider: { width: 1 },
  historyParties: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyPartyChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  historyPartyLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 14 },
  historyPartyAmount: { fontSize: 15, fontWeight: '800', lineHeight: 20, marginTop: 2 },
  historyPartyUnits: { fontSize: 11, lineHeight: 14, marginTop: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  modalClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 20, fontWeight: '400', lineHeight: 24 },
  editHint: { fontSize: 12, lineHeight: 16, marginBottom: 12, fontStyle: 'italic' },
  messageBox: {
    borderRadius: 12, padding: 16, height: 280, borderWidth: 1, marginBottom: 16,
    fontSize: 14, lineHeight: 22,
  },
  regenerateBtn: { alignItems: 'center', paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  regenerateBtnText: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
});
