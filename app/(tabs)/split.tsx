import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { generateBillMessage } from '@/lib/openai';
import {
  addSplitRecord, getSplitRecords, deleteSplitRecord, type SplitRecord,
} from '@/lib/database';
import { useTheme } from '@/lib/theme';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function prevMonth(m: number, y: number) { return m === 1 ? { m: 12, y: y - 1 } : { m: m - 1, y }; }
function nextMonth(m: number, y: number) { return m === 12 ? { m: 1, y: y + 1 } : { m: m + 1, y }; }

type ActiveTab = 'calculator' | 'history';

export default function SplitScreen() {
  const { top: safeTop } = useSafeAreaInsets();
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
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setSplitHistory(await getSplitRecords(db));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = parseFloat(totalAmount || '0');
  const our = parseFloat(ourUnits || '0');
  const top = parseFloat(topFloorUnits || '0');
  const underground = parseFloat(undergroundUnits || '0');
  const totalUnits = our + top + underground;
  const perUnit = totalUnits > 0 ? total / totalUnits : 0;
  const ourAmount = our * perUnit;
  const topAmount = top * perUnit;
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
        ourUnits: our, ourAmount, topFloorUnits: top, topFloorAmount: topAmount,
        undergroundUnits: underground, undergroundAmount,
      };
      const msg = await generateBillMessage(data);
      setGeneratedMessage(msg);
      setCopied(false);
      setShowResult(true);
      await addSplitRecord(db, {
        period: data.period, total_amount: total, total_units: totalUnits, per_unit: perUnit,
        our_units: our, our_amount: ourAmount,
        top_floor_units: top, top_floor_amount: topAmount,
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

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.headerBar, { paddingTop: safeTop + 16, backgroundColor: t.bg }]}>
        <Text style={[styles.screenTitle, { color: t.text }]}>Bill Splitter</Text>
      </View>

      <View style={[styles.tabRow, { backgroundColor: t.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'calculator' && [styles.tabBtnActive, { backgroundColor: t.card }]]}
          onPress={() => setActiveTab('calculator')}
        >
          <Text style={[styles.tabBtnText, { color: t.textSub }, activeTab === 'calculator' && { color: t.primary }]}>Calculator</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && [styles.tabBtnActive, { backgroundColor: t.card }]]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabBtnText, { color: t.textSub }, activeTab === 'history' && { color: t.primary }]}>
            History {splitHistory.length > 0 ? `(${splitHistory.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'calculator' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Billing Period</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>From</Text>
            <DatePicker
              day={fromDay} onDayChange={setFromDay}
              month={fromMonth} year={fromYear}
              onPrev={() => { const p = prevMonth(fromMonth, fromYear); setFromMonth(p.m); setFromYear(p.y); }}
              onNext={() => { const n = nextMonth(fromMonth, fromYear); setFromMonth(n.m); setFromYear(n.y); }}
              theme={t}
            />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>To</Text>
            <DatePicker
              day={toDay} onDayChange={setToDay}
              month={toMonth} year={toYear}
              onPrev={() => { const p = prevMonth(toMonth, toYear); setToMonth(p.m); setToYear(p.y); }}
              onNext={() => { const n = nextMonth(toMonth, toYear); setToMonth(n.m); setToYear(n.y); }}
              theme={t}
            />
            {fromDay && toDay && (
              <View style={[styles.periodPreview, { backgroundColor: t.primaryLight }]}>
                <Text style={[styles.periodPreviewText, { color: t.primaryDark }]}>{buildPeriod()}</Text>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Total Electricity Bill</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Total Amount (₹)</Text>
            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
              value={totalAmount} onChangeText={setTotalAmount}
              keyboardType="decimal-pad" placeholder="e.g. 2700"
              placeholderTextColor={t.textPlaceholder}
            />
          </View>

          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Unit Readings</Text>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Our Floor — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={ourUnits} onChangeText={setOurUnits} keyboardType="decimal-pad" placeholder="e.g. 120" placeholderTextColor={t.textPlaceholder} />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Top Floor — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={topFloorUnits} onChangeText={setTopFloorUnits} keyboardType="decimal-pad" placeholder="e.g. 160" placeholderTextColor={t.textPlaceholder} />
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Underground — Units</Text>
            <TextInput style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]} value={undergroundUnits} onChangeText={setUndergroundUnits} keyboardType="decimal-pad" placeholder="e.g. 80" placeholderTextColor={t.textPlaceholder} />
          </View>

          {totalUnits > 0 && total > 0 && (
            <View style={[styles.calcCard, { backgroundColor: t.card }]}>
              <Text style={[styles.calcTitle, { color: t.text }]}>Bill Breakdown</Text>
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
              <PartyRow label="Our Floor" units={our} amount={ourAmount} color="#6366F1" textColor={t.text} subColor={t.textMuted} />
              <PartyRow label="Top Floor" units={top} amount={topAmount} color="#0EA5E9" textColor={t.text} subColor={t.textMuted} />
              <PartyRow label="Underground" units={underground} amount={undergroundAmount} color="#10B981" textColor={t.text} subColor={t.textMuted} />
              <View style={[styles.totalVerify, { borderTopColor: t.border }]}>
                <Text style={[styles.totalVerifyLabel, { color: t.textSub }]}>Total Check</Text>
                <Text style={[styles.totalVerifyValue, Math.abs((ourAmount + topAmount + undergroundAmount) - total) < 1 ? { color: t.success } : { color: t.danger }]}>
                  ₹{(ourAmount + topAmount + undergroundAmount).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: t.primary }, (!canGenerate || generating) && { opacity: 0.5 }]}
            onPress={handleGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? (
              <View style={styles.generateBtnInner}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.generateBtnText}>Generating with AI...</Text>
              </View>
            ) : (
              <Text style={styles.generateBtnText}>Generate WhatsApp Message</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {splitHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={[styles.emptyTitle, { color: t.text }]}>No split history yet</Text>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>Split records are saved automatically when you generate a WhatsApp message.</Text>
            </View>
          ) : (
            splitHistory.map(record => (
              <View key={record.id} style={[styles.historyCard, { backgroundColor: t.card }]}>
                <View style={styles.historyCardTop}>
                  <View>
                    <Text style={[styles.historyPeriod, { color: t.text }]}>{record.period}</Text>
                    <Text style={[styles.historyDate, { color: t.textMuted }]}>
                      Saved {new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteHistory(record)} style={styles.deleteBtn}>
                    <Text style={[styles.deleteBtnText, { color: t.textMuted }]}>✕</Text>
                  </TouchableOpacity>
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
                  {record.our_units > 0 && <HistoryParty label="Our Floor" units={record.our_units} amount={record.our_amount} color="#6366F1" subColor={t.textMuted} />}
                  {record.top_floor_units > 0 && <HistoryParty label="Top Floor" units={record.top_floor_units} amount={record.top_floor_amount} color="#0EA5E9" subColor={t.textMuted} />}
                  {record.underground_units > 0 && <HistoryParty label="Underground" units={record.underground_units} amount={record.underground_amount} color="#10B981" subColor={t.textMuted} />}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showResult} animationType="slide" transparent onRequestClose={() => setShowResult(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: t.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>WhatsApp Message</Text>
              <TouchableOpacity onPress={() => setShowResult(false)}>
                <Text style={[styles.modalClose, { color: t.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={[styles.messageBox, { backgroundColor: t.cardAlt, borderColor: t.border }]} showsVerticalScrollIndicator={false}>
              <Text style={[styles.messageText, { color: t.text }]} selectable>{generatedMessage}</Text>
            </ScrollView>
            <TouchableOpacity style={[styles.copyBtn, copied && { backgroundColor: t.success }]} onPress={copyToClipboard}>
              <Text style={styles.copyBtnText}>{copied ? '✓ Copied to Clipboard' : 'Copy Message'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.regenerateBtn} onPress={() => { setShowResult(false); handleGenerate(); }}>
              <Text style={[styles.regenerateBtnText, { color: t.textSub }]}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DatePicker({ day, onDayChange, month, year, onPrev, onNext, theme: t }: {
  day: string; onDayChange: (v: string) => void;
  month: number; year: number; onPrev: () => void; onNext: () => void;
  theme: ReturnType<typeof useTheme>;
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
        <TouchableOpacity style={styles.arrowBtn} onPress={onPrev}><Text style={[styles.arrowText, { color: t.primary }]}>‹</Text></TouchableOpacity>
        <Text style={[styles.dateMonthText, { color: t.text }]}>{MONTHS_SHORT[month - 1]} {year}</Text>
        <TouchableOpacity style={styles.arrowBtn} onPress={onNext}><Text style={[styles.arrowText, { color: t.primary }]}>›</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function PartyRow({ label, units, amount, color, textColor, subColor }: { label: string; units: number; amount: number; color: string; textColor: string; subColor: string }) {
  if (units <= 0) return null;
  return (
    <View style={styles.partyRow}>
      <View style={[styles.partyDot, { backgroundColor: color }]} />
      <Text style={[styles.partyLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.partyUnits, { color: subColor }]}>{units.toFixed(0)} units</Text>
      <Text style={[styles.partyAmount, { color }]}>₹{amount.toFixed(2)}</Text>
    </View>
  );
}

function HistoryParty({ label, units, amount, color, subColor }: { label: string; units: number; amount: number; color: string; subColor: string }) {
  return (
    <View style={[styles.historyPartyChip, { borderColor: color + '40', backgroundColor: color + '18' }]}>
      <Text style={[styles.historyPartyLabel, { color }]}>{label}</Text>
      <Text style={[styles.historyPartyAmount, { color }]}>₹{amount.toFixed(2)}</Text>
      <Text style={[styles.historyPartyUnits, { color: subColor }]}>{units.toFixed(0)} u</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { paddingHorizontal: 20, paddingBottom: 12 },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 14, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 60 },
  card: { borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16 },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '700', textAlign: 'center', width: 60 },
  dateSep: { fontSize: 20, fontWeight: '300' },
  monthPicker: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 4 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 24, fontWeight: '300' },
  dateMonthText: { fontSize: 15, fontWeight: '700' },
  periodPreview: { marginTop: 12, borderRadius: 10, padding: 10, alignItems: 'center' },
  periodPreviewText: { fontSize: 13, fontWeight: '600' },
  calcCard: { borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  calcTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  metaRow: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  metaItem: { flex: 1, alignItems: 'center', padding: 12 },
  metaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  metaValue: { fontSize: 16, fontWeight: '700' },
  metaDivider: { width: 1 },
  divider: { height: 1, marginVertical: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  partyDot: { width: 10, height: 10, borderRadius: 5 },
  partyLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  partyUnits: { fontSize: 13, marginRight: 8 },
  partyAmount: { fontSize: 15, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  totalVerify: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  totalVerifyLabel: { fontSize: 13, fontWeight: '600' },
  totalVerifyValue: { fontSize: 15, fontWeight: '700' },
  generateBtn: { borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 8 },
  generateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  historyCard: { borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  historyPeriod: { fontSize: 15, fontWeight: '700' },
  historyDate: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  historyMeta: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  historyMetaItem: { flex: 1, padding: 10, alignItems: 'center' },
  historyMetaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  historyMetaValue: { fontSize: 14, fontWeight: '700' },
  historyMetaDivider: { width: 1 },
  historyParties: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyPartyChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  historyPartyLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  historyPartyAmount: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  historyPartyUnits: { fontSize: 11, marginTop: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalClose: { fontSize: 20, padding: 4 },
  messageBox: { borderRadius: 12, padding: 16, maxHeight: 320, borderWidth: 1, marginBottom: 16 },
  messageText: { fontSize: 14, lineHeight: 22 },
  copyBtn: { backgroundColor: '#6366F1', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  copyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  regenerateBtn: { alignItems: 'center', padding: 8 },
  regenerateBtnText: { fontSize: 14, fontWeight: '600' },
});
