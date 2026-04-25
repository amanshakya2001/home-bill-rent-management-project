import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
  getBills, addBill, updateBill, updateBillStatus, deleteBill,
  saveBillNotificationId, updateBillImage, getLastBillReading,
  getSettings, type Bill,
} from '@/lib/database';
import { scheduleDueNotification, cancelScheduledNotification } from '@/lib/notifications';
import { readMeterFromImage } from '@/lib/openai';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BillsScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [bills, setBills] = useState<Bill[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const now = new Date();
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [prevReading, setPrevReading] = useState('');
  const [currReading, setCurrReading] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [meterImage, setMeterImage] = useState<string | null>(null);

  const unitsConsumed = Math.max(0, parseFloat(currReading || '0') - parseFloat(prevReading || '0'));
  const total = unitsConsumed * parseFloat(pricePerUnit || '0');

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([getBills(db), getSettings(db)]);
    setBills(b);
    setDueDay(String(s.bill_due_day));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openModal() {
    setEditingBill(null);
    const n = new Date();
    setFormMonth(n.getMonth() + 1);
    setFormYear(n.getFullYear());
    setCurrReading('');
    setPricePerUnit('');
    setMeterImage(null);
    setScanning(false);
    const lastReading = await getLastBillReading(db);
    setPrevReading(lastReading !== null ? String(lastReading) : '');
    setShowModal(true);
  }

  function openEditModal(bill: Bill) {
    setEditingBill(bill);
    setFormMonth(bill.month);
    setFormYear(bill.year);
    setPrevReading(String(bill.previous_reading));
    setCurrReading(String(bill.current_reading));
    setPricePerUnit(String(bill.price_per_unit));
    setDueDay(String(parseInt(bill.due_date.split('-')[2])));
    setMeterImage(bill.image_uri);
    setScanning(false);
    setShowModal(true);
  }

  async function scanMeter(source: 'camera' | 'library') {
    let result;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery access is required.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
    }

    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    setMeterImage(asset.uri);
    setScanning(true);

    try {
      const reading = await readMeterFromImage(asset.base64!);
      if (reading !== null) {
        setCurrReading(String(reading));
      } else {
        Alert.alert('Could not read meter', 'AI could not detect a reading. Please enter it manually.');
      }
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Something went wrong. Please enter the reading manually.');
    } finally {
      setScanning(false);
    }
  }

  function promptScanSource() {
    Alert.alert('Scan Meter', 'Choose image source', [
      { text: 'Camera', onPress: () => scanMeter('camera') },
      { text: 'Photo Library', onPress: () => scanMeter('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function saveBill() {
    const prev = parseFloat(prevReading);
    const curr = parseFloat(currReading);
    const p = parseFloat(pricePerUnit);
    const day = parseInt(dueDay);

    if (isNaN(prev) || isNaN(curr) || prev < 0 || curr < 0) {
      Alert.alert('Error', 'Please enter valid meter readings.');
      return;
    }
    if (curr < prev) {
      Alert.alert('Error', 'Current reading cannot be less than previous reading.');
      return;
    }
    if (!p || isNaN(p) || p <= 0) {
      Alert.alert('Error', 'Please enter a valid price per unit.');
      return;
    }
    if (!day || day < 1 || day > 31) {
      Alert.alert('Error', 'Please enter a valid due day (1–31).');
      return;
    }

    const consumed = curr - prev;
    const dueDateStr = `${formYear}-${String(formMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (editingBill) {
      await updateBill(db, editingBill.id, {
        month: formMonth, year: formYear,
        previous_reading: prev, current_reading: curr,
        units_consumed: consumed, price_per_unit: p, total_amount: consumed * p,
        due_date: dueDateStr,
      });
      if (meterImage !== editingBill.image_uri) {
        await updateBillImage(db, editingBill.id, meterImage);
      }
      const s = await getSettings(db);
      if (s.notifications_enabled && editingBill.status === 'unpaid') {
        if (editingBill.notification_id) await cancelScheduledNotification(editingBill.notification_id);
        const dueDate = new Date(formYear, formMonth - 1, day);
        const notifId = await scheduleDueNotification(
          'Electricity Bill Due',
          `₹${(consumed * p).toFixed(2)} due for ${MONTHS[formMonth - 1]} ${formYear}`,
          dueDate
        );
        if (notifId) await saveBillNotificationId(db, editingBill.id, notifId);
      }
    } else {
      const id = await addBill(db, {
        month: formMonth, year: formYear,
        previous_reading: prev, current_reading: curr,
        units_consumed: consumed, price_per_unit: p, total_amount: consumed * p,
        due_date: dueDateStr, status: 'unpaid', paid_date: null, image_uri: meterImage,
      });
      const s = await getSettings(db);
      if (s.notifications_enabled) {
        const dueDate = new Date(formYear, formMonth - 1, day);
        const notifId = await scheduleDueNotification(
          'Electricity Bill Due',
          `₹${(consumed * p).toFixed(2)} due for ${MONTHS[formMonth - 1]} ${formYear}`,
          dueDate
        );
        if (notifId) await saveBillNotificationId(db, id, notifId);
      }
    }

    setEditingBill(null);
    setShowModal(false);
    load();
  }

  async function toggleStatus(bill: Bill) {
    const newStatus = bill.status === 'paid' ? 'unpaid' : 'paid';
    await updateBillStatus(db, bill.id, newStatus);
    if (newStatus === 'paid' && bill.notification_id) {
      await cancelScheduledNotification(bill.notification_id);
      await saveBillNotificationId(db, bill.id, null);
    }
    load();
  }

  function showCardOptions(bill: Bill) {
    const options: any[] = [
      { text: 'Edit Bill', onPress: () => openEditModal(bill) },
      {
        text: bill.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid',
        onPress: () => toggleStatus(bill),
      },
    ];
    if (bill.image_uri) {
      options.push({ text: 'View Meter Photo', onPress: () => setViewImage(bill.image_uri) });
      options.push({
        text: 'Remove Photo', style: 'destructive',
        onPress: async () => { await updateBillImage(db, bill.id, null); load(); },
      });
    }
    options.push({
      text: 'Delete Bill', style: 'destructive',
      onPress: () => confirmDelete(bill),
    });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(`${MONTHS_SHORT[bill.month - 1]} ${bill.year}`, 'Choose an action', options);
  }

  function confirmDelete(bill: Bill) {
    Alert.alert(
      'Delete Bill',
      `Delete electricity bill for ${MONTHS_SHORT[bill.month - 1]} ${bill.year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (bill.notification_id) await cancelScheduledNotification(bill.notification_id);
            await deleteBill(db, bill.id);
            load();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: top + 16 }]}>
        <Text style={styles.screenTitle}>Electricity Bills</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {bills.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No bills yet</Text>
            <Text style={styles.emptyText}>Tap "+ Add" to record your first electricity bill.</Text>
          </View>
        )}
        {bills.map(bill => (
          <TouchableOpacity
            key={bill.id}
            style={styles.card}
            onPress={() => showCardOptions(bill)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardTitle}>{MONTHS[bill.month - 1]} {bill.year}</Text>
                <Text style={styles.cardSub}>Due {formatDate(bill.due_date)}</Text>
              </View>
              <View style={styles.cardTopRight}>
                {bill.image_uri && (
                  <TouchableOpacity onPress={() => setViewImage(bill.image_uri)}>
                    <Image source={{ uri: bill.image_uri }} style={styles.thumbnail} />
                  </TouchableOpacity>
                )}
                <View style={[styles.badge, bill.status === 'paid' ? styles.badgePaid : styles.badgeUnpaid]}>
                  <Text style={[styles.badgeText, bill.status === 'paid' ? styles.textPaid : styles.textUnpaid]}>
                    {bill.status === 'paid' ? 'PAID' : 'UNPAID'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Prev</Text>
                <Text style={styles.statValue}>{bill.previous_reading}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Curr</Text>
                <Text style={styles.statValue}>{bill.current_reading}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Units</Text>
                <Text style={styles.statValue}>{bill.units_consumed}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={[styles.statValue, styles.totalValue]}>₹{bill.total_amount.toFixed(2)}</Text>
              </View>
            </View>
            <Text style={styles.tapHint}>Tap for options</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add Bill Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBill ? 'Edit Electricity Bill' : 'Add Electricity Bill'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Month & Year</Text>
              <View style={styles.monthRow}>
                <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                  if (formMonth === 1) { setFormMonth(12); setFormYear(y => y - 1); }
                  else setFormMonth(m => m - 1);
                }}>
                  <Text style={styles.arrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthText}>{MONTHS[formMonth - 1]} {formYear}</Text>
                <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                  if (formMonth === 12) { setFormMonth(1); setFormYear(y => y + 1); }
                  else setFormMonth(m => m + 1);
                }}>
                  <Text style={styles.arrowText}>›</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Previous Meter Reading</Text>
              <View style={styles.readingRow}>
                <TextInput
                  style={[styles.input, styles.readingInput]}
                  value={prevReading}
                  onChangeText={setPrevReading}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 4520"
                  placeholderTextColor="#D1D5DB"
                />
                {prevReading !== '' && (
                  <View style={styles.autoFilledBadge}>
                    <Text style={styles.autoFilledText}>auto-filled</Text>
                  </View>
                )}
              </View>

              <Text style={styles.fieldLabel}>Current Meter Reading</Text>
              <View style={styles.readingRow}>
                <TextInput
                  style={[styles.input, styles.readingInput]}
                  value={currReading}
                  onChangeText={setCurrReading}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 4640"
                  placeholderTextColor="#D1D5DB"
                  editable={!scanning}
                />
                <TouchableOpacity
                  style={[styles.scanBtn, scanning && styles.scanBtnLoading]}
                  onPress={promptScanSource}
                  disabled={scanning}
                >
                  {scanning
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={styles.scanBtnText}>📷 Scan</Text>
                  }
                </TouchableOpacity>
              </View>

              {meterImage && !scanning && (
                <View style={styles.meterImagePreview}>
                  <Image source={{ uri: meterImage }} style={styles.meterThumb} />
                  <View style={styles.meterImageInfo}>
                    <Text style={styles.meterImageLabel}>Meter photo saved</Text>
                    <TouchableOpacity onPress={() => { setMeterImage(null); setCurrReading(''); }}>
                      <Text style={styles.meterImageRemove}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {scanning && (
                <View style={styles.scanningBanner}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.scanningText}>Reading meter with AI...</Text>
                </View>
              )}

              {prevReading && currReading && !scanning && (
                <View style={styles.unitsRow}>
                  <Text style={styles.unitsLabel}>Units Consumed</Text>
                  <Text style={styles.unitsValue}>{unitsConsumed.toFixed(0)} units</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Price per Unit (₹)</Text>
              <TextInput
                style={styles.input}
                value={pricePerUnit}
                onChangeText={setPricePerUnit}
                keyboardType="decimal-pad"
                placeholder="e.g. 7.50"
                placeholderTextColor="#D1D5DB"
              />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalDisplay}>
                  ₹{isNaN(total) ? '0.00' : total.toFixed(2)}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Due Day (of month)</Text>
              <TextInput
                style={styles.input}
                value={dueDay}
                onChangeText={setDueDay}
                keyboardType="number-pad"
                placeholder="e.g. 10"
                placeholderTextColor="#D1D5DB"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={saveBill}>
                <Text style={styles.saveBtnText}>{editingBill ? 'Update Bill' : 'Save Bill'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen meter image viewer */}
      <Modal visible={!!viewImage} animationType="fade" transparent onRequestClose={() => setViewImage(null)}>
        <View style={styles.imageViewer}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewImage(null)}>
            <Text style={styles.imageViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewImage && (
            <Image source={{ uri: viewImage }} style={styles.imageViewerImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(parts[2])} ${M[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#F3F4F6',
  },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  addBtn: { backgroundColor: '#6366F1', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTopRight: { alignItems: 'flex-end', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  thumbnail: { width: 52, height: 52, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeUnpaid: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  textPaid: { color: '#16A34A' },
  textUnpaid: { color: '#DC2626' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalValue: { color: '#6366F1', fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  tapHint: { fontSize: 11, color: '#D1D5DB', marginTop: 10, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#D1D5DB', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 20, color: '#9CA3AF', padding: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 28, color: '#6366F1', fontWeight: '300' },
  monthText: { fontSize: 18, fontWeight: '700', color: '#111827', minWidth: 160, textAlign: 'center' },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#111827', backgroundColor: '#FAFAFA',
  },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readingInput: { flex: 1 },
  autoFilledBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  autoFilledText: { fontSize: 11, color: '#6366F1', fontWeight: '600' },
  scanBtn: {
    backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  scanBtnLoading: { backgroundColor: '#A5B4FC' },
  scanBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scanningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, marginTop: 8,
  },
  scanningText: { fontSize: 14, color: '#4338CA', fontWeight: '600' },
  meterImagePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  meterThumb: { width: 56, height: 56, borderRadius: 8 },
  meterImageInfo: { flex: 1 },
  meterImageLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  meterImageRemove: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  unitsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 8,
  },
  unitsLabel: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  unitsValue: { fontSize: 15, fontWeight: '700', color: '#15803D' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginTop: 14,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#4338CA' },
  totalDisplay: { fontSize: 20, fontWeight: '700', color: '#4338CA' },
  saveBtn: { backgroundColor: '#6366F1', borderRadius: 14, padding: 16, marginTop: 20, marginBottom: 8, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  imageViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 10 },
  imageViewerCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '300' },
  imageViewerImg: { width: '100%', height: '80%' },
});
