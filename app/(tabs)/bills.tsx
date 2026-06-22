import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';

import {
  getBills, addBill, updateBill, updateBillStatus, deleteBill,
  updateBillImage, getLastBillReading, getLastBillPricePerUnit, type Bill,
} from '@/lib/database';
import { readMeterFromImage } from '@/lib/openai';
import { useTheme, type Theme } from '@/lib/theme';
import { isOverdue as isOverdueShared, safeParseFloat } from '@/lib/dates';
import { logError } from '@/lib/logger';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Pill } from '@/components/ui/pill';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyState } from '@/components/ui/empty-state';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { MonthYearStepper } from '@/components/ui/month-year-stepper';
import { ActionSheet, type ActionSheetItem } from '@/components/ui/action-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
] as const;

const isOverdue = (b: Bill) => isOverdueShared(b.month, b.year, b.status);

export default function BillsScreen() {
  const t = useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [actionBill, setActionBill] = useState<Bill | null>(null);

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
      const data = await getBills();
      if (signal?.cancelled) return;
      setBills(data);
    } catch (err) {
      logError('Bills.load', 'Failed to load bills', err);
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
        getLastBillReading(),
        getLastBillPricePerUnit(),
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
        await updateBill(editingBill.id, { month: formMonth, year: formYear, previous_reading: prev, current_reading: curr, units_consumed: consumed, price_per_unit: p, total_amount: consumed * p });
        if (meterImage !== editingBill.image_uri) await updateBillImage(editingBill.id, meterImage);
      } else {
        await addBill({ month: formMonth, year: formYear, previous_reading: prev, current_reading: curr, units_consumed: consumed, price_per_unit: p, total_amount: consumed * p, status: 'unpaid', paid_date: null, image_uri: meterImage });
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
      await updateBillStatus(bill.id, newStatus);
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
        await deleteBill(bill.id); load();
      }},
    ]);
  }

  function buildActionItems(bill: Bill): ActionSheetItem[] {
    const items: ActionSheetItem[] = [
      { label: 'Edit Bill', onPress: () => openEditModal(bill) },
      { label: bill.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid', onPress: () => toggleStatus(bill) },
    ];
    if (bill.image_uri) {
      items.push({ label: 'View Meter Photo', onPress: () => setViewImage(bill.image_uri) });
      items.push({
        label: 'Remove Photo', destructive: true,
        onPress: async () => { await updateBillImage(bill.id, null); load(); },
      });
    }
    items.push({ label: 'Delete Bill', destructive: true, onPress: () => handleDelete(bill) });
    return items;
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScreenHeader
        title="Electricity Bills"
        meta={overdueCount > 0 && <Pill label={`${overdueCount} overdue`} variant="danger" size="sm" />}
        trailing={
          <PrimaryButton label="+ Add" onPress={openModal} size="md" />
        }
      />

      <View style={styles.controls}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by month, year or amount..."
          placeholderTextColor={t.textPlaceholder}
          clearButtonMode="while-editing"
        />
        <View style={{ marginTop: 12 }}>
          <FilterPills options={FILTERS} value={filterStatus} onChange={setFilterStatus} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {bills.length === 0 ? (
          <EmptyState
            icon="bolt.fill"
            title="No bills yet"
            description='Tap "+ Add" to record your first electricity bill. You can also scan your meter with AI.'
          />
        ) : filteredBills.length === 0 ? (
          <EmptyState
            icon="magnifyingglass"
            title="No results"
            description="Try a different search or filter."
          />
        ) : filteredBills.map(bill => (
          <BillCard
            key={bill.id}
            bill={bill}
            t={t}
            onPress={() => setActionBill(bill)}
            onPay={() => toggleStatus(bill)}
            onDelete={() => handleDelete(bill)}
            onViewImage={() => setViewImage(bill.image_uri)}
          />
        ))}
      </ScrollView>

      <BottomSheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingBill ? 'Edit Bill' : 'Add Electricity Bill'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.fieldLabel, { color: t.textSub }]}>Month & Year</Text>
          <MonthYearStepper
            month={formMonth}
            year={formYear}
            onChange={(m, y) => { setFormMonth(m); setFormYear(y); }}
          />

          <Text style={[styles.fieldLabel, { color: t.textSub }]}>Previous Reading</Text>
          <View style={styles.readingRow}>
            <TextInput
              style={[styles.input, styles.readingInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={prevReading}
              onChangeText={setPrevReading}
              keyboardType="decimal-pad"
              placeholder="e.g. 4520"
              placeholderTextColor={t.textPlaceholder}
            />
            {prevReading !== '' && (
              <Pill label="auto-filled" variant="primary" size="sm" />
            )}
          </View>

          <Text style={[styles.fieldLabel, { color: t.textSub }]}>Current Reading</Text>
          <View style={styles.readingRow}>
            <TextInput
              style={[styles.input, styles.readingInput, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
              value={currReading}
              onChangeText={setCurrReading}
              keyboardType="decimal-pad"
              placeholder="e.g. 4640"
              placeholderTextColor={t.textPlaceholder}
              editable={!scanning}
            />
            <Pressable
              onPress={promptScanSource}
              disabled={scanning}
              style={({ pressed }) => [
                styles.scanBtn,
                { backgroundColor: scanning ? t.textMuted : t.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              {scanning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.scanBtnInner}>
                  <IconSymbol name="camera.fill" size={14} color="#FFFFFF" />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </View>
              )}
            </Pressable>
          </View>

          {meterImage && !scanning && (
            <View style={[styles.meterImagePreview, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <Image source={{ uri: meterImage }} style={styles.meterThumb} />
              <View style={styles.meterImageInfo}>
                <Text style={[styles.meterImageLabel, { color: t.text }]}>Meter photo saved</Text>
                <Pressable
                  onPress={() => { setMeterImage(null); setCurrReading(''); }}
                  hitSlop={8}
                >
                  <Text style={[styles.meterImageRemove, { color: t.dangerText }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}

          {scanning && (
            <View style={[styles.scanningBanner, { backgroundColor: t.primaryLight }]}>
              <ActivityIndicator size="small" color={t.primary} />
              <Text style={[styles.scanningText, { color: t.primaryText }]}>Reading meter with AI...</Text>
            </View>
          )}

          {prevReading && currReading && !scanning && (
            <View style={[styles.unitsRow, { backgroundColor: t.successBg }]}>
              <Text style={[styles.unitsLabel, { color: t.successText }]}>Units Consumed</Text>
              <Text style={[styles.unitsValue, { color: t.successText }]}>{unitsConsumed.toFixed(0)} units</Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: t.textSub }]}>Price per Unit (₹)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
            value={pricePerUnit}
            onChangeText={setPricePerUnit}
            keyboardType="decimal-pad"
            placeholder="e.g. 7.50"
            placeholderTextColor={t.textPlaceholder}
          />

          <View style={[styles.totalRow, { backgroundColor: t.primaryLight }]}>
            <Text style={[styles.totalLabel, { color: t.primaryText }]}>Total Amount</Text>
            <Text style={[styles.totalDisplay, { color: t.primaryText }]}>₹{isNaN(total) ? '0.00' : total.toFixed(2)}</Text>
          </View>

          <PrimaryButton
            label={editingBill ? 'Update Bill' : 'Save Bill'}
            onPress={saveBill}
            size="lg"
            style={{ marginTop: 20, marginBottom: 8 }}
          />
        </ScrollView>
      </BottomSheet>

      <Modal visible={!!viewImage} animationType="fade" transparent onRequestClose={() => setViewImage(null)}>
        <View style={styles.imageViewer}>
          <Pressable
            onPress={() => setViewImage(null)}
            hitSlop={12}
            style={({ pressed }) => [styles.imageViewerClose, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.imageViewerCloseText}>✕</Text>
          </Pressable>
          {viewImage && <Image source={{ uri: viewImage }} style={styles.imageViewerImg} resizeMode="contain" />}
        </View>
      </Modal>

      <ActionSheet
        visible={!!actionBill}
        onClose={() => setActionBill(null)}
        title={actionBill ? `${MONTHS_SHORT[actionBill.month - 1]} ${actionBill.year}` : undefined}
        items={actionBill ? buildActionItems(actionBill) : []}
      />
    </View>
  );
}

function BillCard({
  bill, t, onPress, onPay, onDelete, onViewImage,
}: {
  bill: Bill; t: Theme; onPress: () => void; onPay: () => void; onDelete: () => void; onViewImage: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const overdue = isOverdue(bill);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        {bill.status === 'unpaid' && (
          <Pressable
            style={[styles.swipeBtn, { backgroundColor: t.success }]}
            onPress={() => { swipeRef.current?.close(); onPay(); }}
          >
            <Text style={styles.swipeActionText}>✓ Pay</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.swipeBtn, { backgroundColor: t.danger }]}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
        >
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: t.card, shadowColor: t.shadow },
          overdue && { borderWidth: 1.5, borderColor: t.danger },
          pressed && { opacity: 0.85 },
        ]}
      >
        {overdue && <View style={[styles.overdueStripe, { backgroundColor: t.danger }]} />}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: t.text }]}>{MONTHS[bill.month - 1]} {bill.year}</Text>
          </View>
          <View style={styles.cardTopRight}>
            {bill.image_uri && (
              <Pressable onPress={onViewImage} hitSlop={4}>
                <Image source={{ uri: bill.image_uri }} style={[styles.thumbnail, { borderColor: t.border }]} />
              </Pressable>
            )}
            <Pill
              label={bill.status === 'paid' ? 'PAID' : overdue ? 'OVERDUE' : 'UNPAID'}
              variant={bill.status === 'paid' ? 'success' : 'danger'}
            />
          </View>
        </View>
        <View style={[styles.cardBottom, { backgroundColor: t.cardAlt }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>Prev</Text>
            <Text style={[styles.statValue, { color: t.textSub }]}>{bill.previous_reading}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>Curr</Text>
            <Text style={[styles.statValue, { color: t.textSub }]}>{bill.current_reading}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>Units</Text>
            <Text style={[styles.statValue, { color: t.textSub }]}>{bill.units_consumed}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>Total</Text>
            <Text style={[styles.statValue, { color: t.text, fontWeight: '700' }]}>₹{bill.total_amount.toFixed(2)}</Text>
          </View>
        </View>
        {bill.status === 'unpaid' && (
          <PrimaryButton
            label="Mark as Paid"
            onPress={onPay}
            variant="success"
            style={{ marginTop: 12 }}
          />
        )}
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: 20, paddingBottom: 12 },
  searchInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, lineHeight: 18, borderWidth: 1.5, minHeight: 44,
  },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden',
  },
  overdueStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  cardTopRight: { alignItems: 'flex-end', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  thumbnail: { width: 52, height: 52, borderRadius: 8, borderWidth: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, lineHeight: 14 },
  statValue: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  statDivider: { width: 1 },
  swipeActions: { flexDirection: 'row', marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  swipeBtn: { justifyContent: 'center', alignItems: 'center', width: 70 },
  swipeActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 22, minHeight: 48 },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readingInput: { flex: 1 },
  scanBtn: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 88,
  },
  scanBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scanBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', lineHeight: 18 },
  scanningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12, marginTop: 8 },
  scanningText: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  meterImagePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1 },
  meterThumb: { width: 56, height: 56, borderRadius: 8 },
  meterImageInfo: { flex: 1 },
  meterImageLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  meterImageRemove: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 4 },
  unitsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12, marginTop: 8 },
  unitsLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  unitsValue: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 16 },
  totalLabel: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  totalDisplay: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  imageViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  imageViewerCloseText: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', lineHeight: 28 },
  imageViewerImg: { width: '100%', height: '80%' },
});
