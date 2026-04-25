import { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { generateBillMessage } from '@/lib/openai';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function prevMonth(m: number, y: number) {
  return m === 1 ? { m: 12, y: y - 1 } : { m: m - 1, y };
}
function nextMonth(m: number, y: number) {
  return m === 12 ? { m: 1, y: y + 1 } : { m: m + 1, y };
}

export default function SplitScreen() {
  const { top: safeTop } = useSafeAreaInsets();
  const now = new Date();

  // From date
  const [fromDay, setFromDay] = useState('1');
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear, setFromYear] = useState(now.getFullYear());

  // To date
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
    if (!canGenerate) {
      Alert.alert('Missing data', 'Please enter total amount and at least one unit reading.');
      return;
    }
    const fd = parseInt(fromDay), td = parseInt(toDay);
    if (!fd || fd < 1 || fd > 31 || !td || td < 1 || td > 31) {
      Alert.alert('Invalid dates', 'Please enter valid day values (1–31).');
      return;
    }

    setGenerating(true);
    try {
      const msg = await generateBillMessage({
        period: buildPeriod(),
        totalAmount: total,
        totalUnits,
        perUnit,
        ourUnits: our,
        ourAmount,
        topFloorUnits: top,
        topFloorAmount: topAmount,
        undergroundUnits: underground,
        undergroundAmount,
      });
      setGeneratedMessage(msg);
      setCopied(false);
      setShowResult(true);
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

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: safeTop + 16 }]}>
        <Text style={styles.screenTitle}>Bill Splitter</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Billing Period */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Billing Period</Text>

          <Text style={styles.fieldLabel}>From</Text>
          <DatePicker
            day={fromDay} onDayChange={setFromDay}
            month={fromMonth} year={fromYear}
            onPrev={() => { const p = prevMonth(fromMonth, fromYear); setFromMonth(p.m); setFromYear(p.y); }}
            onNext={() => { const n = nextMonth(fromMonth, fromYear); setFromMonth(n.m); setFromYear(n.y); }}
          />

          <Text style={styles.fieldLabel}>To</Text>
          <DatePicker
            day={toDay} onDayChange={setToDay}
            month={toMonth} year={toYear}
            onPrev={() => { const p = prevMonth(toMonth, toYear); setToMonth(p.m); setToYear(p.y); }}
            onNext={() => { const n = nextMonth(toMonth, toYear); setToMonth(n.m); setToYear(n.y); }}
          />

          {canGenerate === false || (fromDay && toDay) ? (
            <View style={styles.periodPreview}>
              <Text style={styles.periodPreviewText}>{buildPeriod()}</Text>
            </View>
          ) : null}
        </View>

        {/* Total amount */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Electricity Bill</Text>
          <Text style={styles.fieldLabel}>Total Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={totalAmount}
            onChangeText={setTotalAmount}
            keyboardType="decimal-pad"
            placeholder="e.g. 2700"
            placeholderTextColor="#D1D5DB"
          />
        </View>

        {/* Unit inputs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unit Readings</Text>

          <Text style={styles.fieldLabel}>Our Floor — Units</Text>
          <TextInput
            style={styles.input}
            value={ourUnits}
            onChangeText={setOurUnits}
            keyboardType="decimal-pad"
            placeholder="e.g. 120"
            placeholderTextColor="#D1D5DB"
          />

          <Text style={styles.fieldLabel}>Top Floor — Units</Text>
          <TextInput
            style={styles.input}
            value={topFloorUnits}
            onChangeText={setTopFloorUnits}
            keyboardType="decimal-pad"
            placeholder="e.g. 160"
            placeholderTextColor="#D1D5DB"
          />

          <Text style={styles.fieldLabel}>Underground — Units</Text>
          <TextInput
            style={styles.input}
            value={undergroundUnits}
            onChangeText={setUndergroundUnits}
            keyboardType="decimal-pad"
            placeholder="e.g. 80"
            placeholderTextColor="#D1D5DB"
          />
        </View>

        {/* Live calculation */}
        {totalUnits > 0 && total > 0 && (
          <View style={styles.calcCard}>
            <Text style={styles.calcTitle}>Bill Breakdown</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Per Unit Rate</Text>
                <Text style={styles.metaValue}>₹{perUnit.toFixed(2)}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total Units</Text>
                <Text style={styles.metaValue}>{totalUnits.toFixed(0)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <PartyRow label="Our Floor" units={our} amount={ourAmount} color="#6366F1" />
            <PartyRow label="Top Floor" units={top} amount={topAmount} color="#0EA5E9" />
            <PartyRow label="Underground" units={underground} amount={undergroundAmount} color="#10B981" />

            <View style={styles.totalVerify}>
              <Text style={styles.totalVerifyLabel}>Total Check</Text>
              <Text style={[
                styles.totalVerifyValue,
                Math.abs((ourAmount + topAmount + undergroundAmount) - total) < 1
                  ? styles.totalVerifyOk : styles.totalVerifyWarn,
              ]}>
                ₹{(ourAmount + topAmount + undergroundAmount).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, (!canGenerate || generating) && styles.generateBtnDisabled]}
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

      {/* Result modal */}
      <Modal visible={showResult} animationType="slide" transparent onRequestClose={() => setShowResult(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>WhatsApp Message</Text>
              <TouchableOpacity onPress={() => setShowResult(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.messageBox} showsVerticalScrollIndicator={false}>
              <Text style={styles.messageText} selectable>{generatedMessage}</Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={copyToClipboard}
            >
              <Text style={styles.copyBtnText}>
                {copied ? '✓ Copied to Clipboard' : 'Copy Message'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.regenerateBtn} onPress={() => { setShowResult(false); handleGenerate(); }}>
              <Text style={styles.regenerateBtnText}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DatePicker({
  day, onDayChange, month, year, onPrev, onNext,
}: {
  day: string; onDayChange: (v: string) => void;
  month: number; year: number;
  onPrev: () => void; onNext: () => void;
}) {
  return (
    <View style={styles.datePicker}>
      <TextInput
        style={styles.dayInput}
        value={day}
        onChangeText={onDayChange}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="DD"
        placeholderTextColor="#D1D5DB"
      />
      <Text style={styles.dateSep}>/</Text>
      <View style={styles.monthPicker}>
        <TouchableOpacity style={styles.arrowBtn} onPress={onPrev}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateMonthText}>{MONTHS_SHORT[month - 1]} {year}</Text>
        <TouchableOpacity style={styles.arrowBtn} onPress={onNext}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PartyRow({ label, units, amount, color }: { label: string; units: number; amount: number; color: string }) {
  if (units <= 0) return null;
  return (
    <View style={styles.partyRow}>
      <View style={[styles.partyDot, { backgroundColor: color }]} />
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyUnits}>{units.toFixed(0)} units</Text>
      <Text style={[styles.partyAmount, { color }]}>₹{amount.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  headerBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#111827', backgroundColor: '#FAFAFA',
  },
  // Date picker
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, fontSize: 18, fontWeight: '700', color: '#6366F1',
    textAlign: 'center', width: 60, backgroundColor: '#FAFAFA',
  },
  dateSep: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },
  monthPicker: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 4 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 24, color: '#6366F1', fontWeight: '300' },
  dateMonthText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  periodPreview: {
    marginTop: 12, backgroundColor: '#EEF2FF', borderRadius: 10,
    padding: 10, alignItems: 'center',
  },
  periodPreviewText: { fontSize: 13, fontWeight: '600', color: '#4338CA' },
  // Calc card
  calcCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  calcTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  metaRow: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, overflow: 'hidden' },
  metaItem: { flex: 1, alignItems: 'center', padding: 12 },
  metaLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  metaValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  metaDivider: { width: 1, backgroundColor: '#E5E7EB' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  partyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  partyDot: { width: 10, height: 10, borderRadius: 5 },
  partyLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  partyUnits: { fontSize: 13, color: '#9CA3AF', marginRight: 8 },
  partyAmount: { fontSize: 15, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  totalVerify: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4,
  },
  totalVerifyLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  totalVerifyValue: { fontSize: 15, fontWeight: '700' },
  totalVerifyOk: { color: '#16A34A' },
  totalVerifyWarn: { color: '#DC2626' },
  generateBtn: {
    backgroundColor: '#6366F1', borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 8,
  },
  generateBtnDisabled: { backgroundColor: '#A5B4FC' },
  generateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 20, color: '#9CA3AF', padding: 4 },
  messageBox: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16,
    maxHeight: 320, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
  messageText: { fontSize: 14, color: '#111827', lineHeight: 22 },
  copyBtn: {
    backgroundColor: '#6366F1', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 10,
  },
  copyBtnSuccess: { backgroundColor: '#16A34A' },
  copyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  regenerateBtn: { alignItems: 'center', padding: 8 },
  regenerateBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});
