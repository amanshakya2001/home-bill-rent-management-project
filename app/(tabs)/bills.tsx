import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';

import {
  getBills, addBill, updateBill, updateBillStatus, deleteBill,
  updateBillImage, getLastBillReading, getLastBillPricePerUnit, type Bill,
} from '@/lib/database';
import { readMeterFromImage } from '@/lib/openai';
import { useTheme } from '@/lib/theme';
import { isOverdue as isOverdueShared, safeParseFloat } from '@/lib/dates';
import { logError } from '@/lib/logger';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isOverdue = (b: Bill) => isOverdueShared(b.month, b.year, b.status);

export default function BillsScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const t = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  const now = new Date();
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [prevReading, setPrevReading] = useState('');
  const [currReading, setCurrReading] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [meterImage, setMeterImage] = useState<string | null>(null);

  const unitsConsumed = Math.max(0, safeParseFloat(currReading) - safeParseFloat(prevReading));
  const total = unitsConsumed * safeParseFloat(pricePerUnit);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await getBills(db);
      if (signal?.cancelled) return;
      setBills(data);
    } catch (err) {
      logError('Bills.load', 'Failed to load bills', err);
    }
  }, [db]);

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

  const sortedBills = [...bills].sort((a, b) => {
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return b.year !== a.year ? b.year - a.year : b.month - a.month;
  });

  const filteredBills = sortedBills.filter(bill => {
    if (filterStatus !== 'all' && bill.status !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return MONTHS[bill.month - 1].toLowerCase().includes(s) || String(bill.year).includes(s) || String(bill.total_amount).includes(s);
    }
    return true;
  });

  const overdueCount = bills.filter(isOverdue).length;

  async function openModal() {
    setEditingBill(null);
    const n = new Date();
    setFormMonth(n.getMonth() + 1);
    setFormYear(n.getFullYear());
    setCurrReading(''); setMeterImage(null); setScanning(false);
    try {
      const [lastReading, lastPrice] = await Promise.all([
        getLastBillReading(db),
        getLastBillPricePerUnit(db),
      ]);
      setPrevReading(lastReading !== null ? String(lastReading) : '');
      setPricePerUnit(lastPrice !== null ? String(lastPrice) : '');
    } catch (err) {
      logError('Bills.openModal', 'Failed to prefill from last bill', err);
      setPrevReading('');
      setPricePerUnit('');
    }
    setShowModal(true);
  }

  function openEditModal(bill: Bill) {
    setEditingBill(bill);
    setFormMonth(bill.month); setFormYear(bill.year);
    setPrevReading(String(bill.previous_reading)); setCurrReading(String(bill.current_reading));
    setPricePerUnit(String(bill.price_per_unit)); setMeterImage(bill.image_uri);
    setScanning(false); setShowModal(true);
  }

  async function scanMeter(source: 'camera' | 'library') {
    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Gallery access is required.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    }
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setMeterImage(asset.uri); setScanning(true);
    try {
      const reading = await readMeterFromImage(asset.base64!);
      if (reading !== null) setCurrReading(String(reading));
      else Alert.alert('Could not read meter', 'AI could not detect a reading. Please enter it manually.');
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Something went wrong.');
    } finally { setScanning(false); }
  }

  function promptScanSource() {
    Alert.alert('Scan Meter', 'Choose image source', [
      { text: 'Camera', onPress: () => scanMeter('camera') },
      { text: 'Photo Library', onPress: () => scanMeter('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function saveBill() {
    const prev = parseFloat(prevReading), curr = parseFloat(currReading), p = parseFloat(pricePerUnit);
    if (isNaN(prev) || isNaN(curr) || prev < 0 || curr < 0) { Alert.alert('Error', 'Please enter valid meter readings.'); return; }
    if (curr < prev) { Alert.alert('Error', 'Current reading cannot be less than previous reading.'); return; }
    if (!p || isNaN(p) || p <= 0) { Alert.alert('Error', 'Please enter a valid price per unit.'); return; }
    const consumed = curr - prev;
    try {
      if (editingBill) {
        await updateBill(db, editingBill.id, { month: formMonth, year: formYear, previous_reading: prev, current_reading: curr, units_consumed: consumed, price_per_unit: p, total_amount: consumed * p });
        if (meterImage !== editingBill.image_uri) await updateBillImage(db, editingBill.id, meterImage);
      } else {
        await addBill(db, { month: formMonth, year: formYear, previous_reading: prev, current_reading: curr, units_consumed: consumed, price_per_unit: p, total_amount: consumed * p, status: 'unpaid', paid_date: null, image_uri: meterImage });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingBill(null); setShowModal(false); load();
    } catch (err) {
      logError('Bills.saveBill', 'Failed to save bill', err);
      Alert.alert('Error', 'Could not save bill. Please try again.');
    }
  }

  async function toggleStatus(bill: Bill) {
    const newStatus = bill.status === 'paid' ? 'unpaid' : 'paid';
    try {
      await updateBillStatus(db, bill.id, newStatus);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      load();
    } catch (err) {
      logError('Bills.toggleStatus', 'Failed to update bill status', err);
      Alert.alert('Error', 'Could not update payment status. Please try again.');
    }
  }

  async function handleDelete(bill: Bill) {
    Alert.alert('Delete Bill', `Delete bill for ${MONTHS_SHORT[bill.month - 1]} ${bill.year}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await deleteBill(db, bill.id); load();
      }},
    ]);
  }

  function showCardOptions(bill: Bill) {
    const options: any[] = [
      { text: 'Edit Bill', onPress: () => openEditModal(bill) },
      { text: bill.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid', onPress: () => toggleStatus(bill) },
    ];
    if (bill.image_uri) {
      options.push({ text: 'View Meter Photo', onPress: () => setViewImage(bill.image_uri) });
      options.push({ text: 'Remove Photo', style: 'destructive', onPress: async () => { await updateBillImage(db, bill.id, null); load(); } });
    }
    options.push({ text: 'Delete Bill', style: 'destructive', onPress: () => handleDelete(bill) });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(`${MONTHS_SHORT[bill.month - 1]} ${bill.year}`, 'Choose an action', options);
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.headerBar, { paddingTop: top + 16, backgroundColor: t.bg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.screenTitle, { color: t.text }]}>Electricity Bills</Text>
          {overdueCount > 0 && <View style={[styles.overdueBadge, { backgroundColor: t.dangerLight }]}><Text style={[styles.overdueBadgeText, { color: t.danger }]}>{overdueCount} overdue</Text></View>}
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput style={[styles.searchInput, { backgroundColor: t.card, borderColor: t.border, color: t.text }]} value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={t.textPlaceholder} clearButtonMode="while-editing" />
      </View>
      <View style={styles.filterRow}>
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterBtn, { backgroundColor: filterStatus === f ? t.primary : t.border }]} onPress={() => setFilterStatus(f)}>
            <Text style={[styles.filterBtnText, { color: filterStatus === f ? '#FFFFFF' : t.textSub }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {bills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⚡</Text>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No bills yet</Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>Tap "+ Add" to record your first electricity bill. You can also scan your meter with AI!</Text>
          </View>
        ) : filteredBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No results</Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>Try a different search or filter.</Text>
          </View>
        ) : filteredBills.map(bill => (
          <BillCard key={bill.id} bill={bill} t={t}
            onPress={() => showCardOptions(bill)}
            onPay={() => toggleStatus(bill)}
            onDelete={() => handleDelete(bill)}
            onViewImage={() => setViewImage(bill.image_uri)}
          />
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: t.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>{editingBill ? 'Edit Bill' : 'Add Electricity Bill'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={[styles.modalClose, { color: t.textMuted }]}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: t.textSub }]}>Month & Year</Text>
              <View style={styles.monthRow}>
                <TouchableOpacity style={styles.arrowBtn} onPress={() => { if (formMonth === 1) { setFormMonth(12); setFormYear(y => y - 1); } else setFormMonth(m => m - 1); }}><Text style={[styles.arrowText, { color: t.primary }]}>‹</Text></TouchableOpacity>
                <Text style={[styles.monthText, { color: t.text }]}>{MONTHS[formMonth - 1]} {formYear}</Text>
                <TouchableOpacity style={styles.arrowBtn} onPress={() => { if (formMonth === 12) { setFormMonth(1); setFormYear(y => y + 1); } else setFormMonth(m => m + 1); }}><Text style={[styles.arrowText, { color: t.primary }]}>›</Text></TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: t.textSub }]}>Previous Reading</Text>
              <View style={styles.readingRow}>
                <TextInput style={[styles.input, styles.readingInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]} value={prevReading} onChangeText={setPrevReading} keyboardType="decimal-pad" placeholder="e.g. 4520" placeholderTextColor={t.textPlaceholder} />
                {prevReading !== '' && <View style={[styles.autoFilledBadge, { backgroundColor: t.primaryLight }]}><Text style={[styles.autoFilledText, { color: t.primary }]}>auto-filled</Text></View>}
              </View>

              <Text style={[styles.fieldLabel, { color: t.textSub }]}>Current Reading</Text>
              <View style={styles.readingRow}>
                <TextInput style={[styles.input, styles.readingInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]} value={currReading} onChangeText={setCurrReading} keyboardType="decimal-pad" placeholder="e.g. 4640" placeholderTextColor={t.textPlaceholder} editable={!scanning} />
                <TouchableOpacity style={[styles.scanBtn, { backgroundColor: scanning ? t.textMuted : t.primary }]} onPress={promptScanSource} disabled={scanning}>
                  {scanning ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.scanBtnText}>📷 Scan</Text>}
                </TouchableOpacity>
              </View>

              {meterImage && !scanning && (
                <View style={[styles.meterImagePreview, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
                  <Image source={{ uri: meterImage }} style={styles.meterThumb} />
                  <View style={styles.meterImageInfo}>
                    <Text style={[styles.meterImageLabel, { color: t.text }]}>Meter photo saved</Text>
                    <TouchableOpacity onPress={() => { setMeterImage(null); setCurrReading(''); }}><Text style={[styles.meterImageRemove, { color: t.danger }]}>Remove</Text></TouchableOpacity>
                  </View>
                </View>
              )}

              {scanning && <View style={[styles.scanningBanner, { backgroundColor: t.primaryLight }]}><ActivityIndicator size="small" color={t.primary} /><Text style={[styles.scanningText, { color: t.primaryDark }]}>Reading meter with AI...</Text></View>}

              {prevReading && currReading && !scanning && (
                <View style={[styles.unitsRow, { backgroundColor: t.successBg }]}>
                  <Text style={[styles.unitsLabel, { color: t.success }]}>Units Consumed</Text>
                  <Text style={[styles.unitsValue, { color: t.success }]}>{unitsConsumed.toFixed(0)} units</Text>
                </View>
              )}

              <Text style={[styles.fieldLabel, { color: t.textSub }]}>Price per Unit (₹)</Text>
              <TextInput style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]} value={pricePerUnit} onChangeText={setPricePerUnit} keyboardType="decimal-pad" placeholder="e.g. 7.50" placeholderTextColor={t.textPlaceholder} />

              <View style={[styles.totalRow, { backgroundColor: t.primaryLight }]}>
                <Text style={[styles.totalLabel, { color: t.primaryDark }]}>Total Amount</Text>
                <Text style={[styles.totalDisplay, { color: t.primaryDark }]}>₹{isNaN(total) ? '0.00' : total.toFixed(2)}</Text>
              </View>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: t.primary }]} onPress={saveBill}>
                <Text style={styles.saveBtnText}>{editingBill ? 'Update Bill' : 'Save Bill'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!viewImage} animationType="fade" transparent onRequestClose={() => setViewImage(null)}>
        <View style={styles.imageViewer}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewImage(null)}><Text style={styles.imageViewerCloseText}>✕</Text></TouchableOpacity>
          {viewImage && <Image source={{ uri: viewImage }} style={styles.imageViewerImg} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

function BillCard({ bill, t, onPress, onPay, onDelete, onViewImage }: { bill: Bill; t: any; onPress: () => void; onPay: () => void; onDelete: () => void; onViewImage: () => void }) {
  const swipeRef = useRef<Swipeable>(null);
  const overdue = isOverdue(bill);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        {bill.status === 'unpaid' && <TouchableOpacity style={styles.swipePayBtn} onPress={() => { swipeRef.current?.close(); onPay(); }}><Text style={styles.swipeActionText}>✓ Pay</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => { swipeRef.current?.close(); onDelete(); }}><Text style={styles.swipeActionText}>Delete</Text></TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity style={[styles.card, { backgroundColor: t.card }, overdue && { borderWidth: 1.5, borderColor: t.danger }]} onPress={onPress} activeOpacity={0.7}>
        {overdue && <View style={[styles.overdueStripe, { backgroundColor: t.danger }]} />}
        <View style={styles.cardTop}>
          <View>
            <Text style={[styles.cardTitle, { color: t.text }]}>{MONTHS[bill.month - 1]} {bill.year}</Text>
            {overdue && <Text style={[styles.overdueLabel, { color: t.danger }]}>OVERDUE</Text>}
          </View>
          <View style={styles.cardTopRight}>
            {bill.image_uri && <TouchableOpacity onPress={onViewImage}><Image source={{ uri: bill.image_uri }} style={styles.thumbnail} /></TouchableOpacity>}
            <View style={[styles.badge, bill.status === 'paid' ? { backgroundColor: t.successLight } : { backgroundColor: t.dangerLight }]}>
              <Text style={[styles.badgeText, { color: bill.status === 'paid' ? t.success : t.danger }]}>{bill.status === 'paid' ? 'PAID' : 'UNPAID'}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.cardBottom, { backgroundColor: t.cardAlt }]}>
          <View style={styles.statItem}><Text style={[styles.statLabel, { color: t.textMuted }]}>Prev</Text><Text style={[styles.statValue, { color: t.textSub }]}>{bill.previous_reading}</Text></View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}><Text style={[styles.statLabel, { color: t.textMuted }]}>Curr</Text><Text style={[styles.statValue, { color: t.textSub }]}>{bill.current_reading}</Text></View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}><Text style={[styles.statLabel, { color: t.textMuted }]}>Units</Text><Text style={[styles.statValue, { color: t.textSub }]}>{bill.units_consumed}</Text></View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}><Text style={[styles.statLabel, { color: t.textMuted }]}>Total</Text><Text style={[styles.statValue, { color: t.primary, fontWeight: '700' }]}>₹{bill.total_amount.toFixed(2)}</Text></View>
        </View>
        {bill.status === 'unpaid' && (
          <TouchableOpacity style={[styles.quickPayBtn, { backgroundColor: t.successBg, borderColor: t.successLight }]} onPress={onPay}>
            <Text style={[styles.quickPayText, { color: t.success }]}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  overdueBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  overdueBadgeText: { fontSize: 11, fontWeight: '700' },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1.5 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden' },
  overdueStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  overdueLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTopRight: { alignItems: 'flex-end', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  thumbnail: { width: 52, height: 52, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '600' },
  statDivider: { width: 1 },
  quickPayBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1 },
  quickPayText: { fontSize: 13, fontWeight: '700' },
  swipeActions: { flexDirection: 'row', marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  swipePayBtn: { backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', width: 70 },
  swipeDeleteBtn: { backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', width: 70 },
  swipeActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalClose: { fontSize: 20, padding: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 28, fontWeight: '300' },
  monthText: { fontSize: 18, fontWeight: '700', minWidth: 160, textAlign: 'center' },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16 },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readingInput: { flex: 1 },
  autoFilledBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  autoFilledText: { fontSize: 11, fontWeight: '600' },
  scanBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  scanBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scanningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12, marginTop: 8 },
  scanningText: { fontSize: 14, fontWeight: '600' },
  meterImagePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1 },
  meterThumb: { width: 56, height: 56, borderRadius: 8 },
  meterImageInfo: { flex: 1 },
  meterImageLabel: { fontSize: 13, fontWeight: '600' },
  meterImageRemove: { fontSize: 12, marginTop: 4 },
  unitsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12, marginTop: 8 },
  unitsLabel: { fontSize: 13, fontWeight: '600' },
  unitsValue: { fontSize: 15, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 14 },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalDisplay: { fontSize: 20, fontWeight: '700' },
  saveBtn: { borderRadius: 14, padding: 16, marginTop: 20, marginBottom: 8, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  imageViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 10 },
  imageViewerCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '300' },
  imageViewerImg: { width: '100%', height: '80%' },
});
