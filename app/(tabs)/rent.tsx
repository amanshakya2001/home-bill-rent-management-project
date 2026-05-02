import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  Alert, Animated, Modal, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import {
  getRentPayments, addRentPayment, updateRentPayment, updateRentStatus,
  deleteRentPayment, getLastRentAmount, type Rent,
} from '@/lib/database';
import { useTheme, type Theme } from '@/lib/theme';
import { isOverdue as isOverdueShared } from '@/lib/dates';
import { logError } from '@/lib/logger';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isOverdue = (r: Rent) => isOverdueShared(r.month, r.year, r.status);

export default function RentScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const t = useTheme();
  const [rents, setRents] = useState<Rent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRent, setEditingRent] = useState<Rent | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  const now = new Date();
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState('');

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await getRentPayments(db);
      if (signal?.cancelled) return;
      setRents(data);
    } catch (err) {
      logError('Rent.load', 'Failed to load rent payments', err);
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

  const sortedRents = [...rents].sort((a, b) => {
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return b.year !== a.year ? b.year - a.year : b.month - a.month;
  });

  const filteredRents = sortedRents.filter(rent => {
    if (filterStatus !== 'all' && rent.status !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return MONTHS[rent.month - 1].toLowerCase().includes(s) ||
        String(rent.year).includes(s) ||
        String(rent.amount).includes(s);
    }
    return true;
  });

  const overdueCount = rents.filter(isOverdue).length;

  async function openModal() {
    setEditingRent(null);
    const n = new Date();
    setFormMonth(n.getMonth() + 1);
    setFormYear(n.getFullYear());
    try {
      const last = await getLastRentAmount(db);
      setAmount(last !== null ? String(last) : '');
    } catch (err) {
      logError('Rent.openModal', 'Failed to prefill rent amount', err);
      setAmount('');
    }
    setShowModal(true);
  }

  function openEditModal(rent: Rent) {
    setEditingRent(rent);
    setFormMonth(rent.month);
    setFormYear(rent.year);
    setAmount(String(rent.amount));
    setShowModal(true);
  }

  async function saveRent() {
    const a = parseFloat(amount);
    if (!a || isNaN(a) || a <= 0) { Alert.alert('Error', 'Please enter a valid rent amount.'); return; }
    try {
      if (editingRent) {
        await updateRentPayment(db, editingRent.id, { month: formMonth, year: formYear, amount: a });
      } else {
        await addRentPayment(db, { month: formMonth, year: formYear, amount: a, status: 'unpaid', paid_date: null });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingRent(null);
      setShowModal(false);
      load();
    } catch (err) {
      logError('Rent.saveRent', 'Failed to save rent payment', err);
      Alert.alert('Error', 'Could not save rent payment. Please try again.');
    }
  }

  async function toggleStatus(rent: Rent) {
    const newStatus = rent.status === 'paid' ? 'unpaid' : 'paid';
    try {
      await updateRentStatus(db, rent.id, newStatus);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      load();
    } catch (err) {
      logError('Rent.toggleStatus', 'Failed to update rent status', err);
      Alert.alert('Error', 'Could not update payment status. Please try again.');
    }
  }

  async function handleDelete(rent: Rent) {
    Alert.alert('Delete Rent', `Delete rent record for ${MONTHS_SHORT[rent.month - 1]} ${rent.year}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteRentPayment(db, rent.id);
          load();
        },
      },
    ]);
  }

  function showCardOptions(rent: Rent) {
    Alert.alert(`${MONTHS_SHORT[rent.month - 1]} ${rent.year}`, 'Choose an action', [
      { text: 'Edit', onPress: () => openEditModal(rent) },
      { text: rent.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid', onPress: () => toggleStatus(rent) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(rent) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const totalUnpaid = rents.filter(r => r.status === 'unpaid').reduce((s, r) => s + r.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.headerBar, { paddingTop: top + 16, backgroundColor: t.bg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.screenTitle, { color: t.text }]}>Rent Payments</Text>
          {overdueCount > 0 && (
            <View style={[styles.overdueBadge, { backgroundColor: t.dangerLight }]}>
              <Text style={[styles.overdueBadgeText, { color: t.danger }]}>{overdueCount} overdue</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {totalUnpaid > 0 && (
        <View style={[styles.summaryBanner, { backgroundColor: t.dangerLight }]}>
          <Text style={[styles.summaryText, { color: t.danger }]}>Pending rent</Text>
          <Text style={[styles.summaryAmount, { color: t.danger }]}>₹{totalUnpaid.toLocaleString('en-IN')}</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by month, year or amount..."
          placeholderTextColor={t.textPlaceholder}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={styles.filterRow}>
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, { backgroundColor: t.border }, filterStatus === f && { backgroundColor: t.primary }]}
            onPress={() => setFilterStatus(f)}
          >
            <Text style={[styles.filterBtnText, { color: t.textSub }, filterStatus === f && styles.filterBtnTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {rents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No rent records yet</Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>Tap "+ Add" above to record your first rent payment and track monthly status.</Text>
          </View>
        ) : filteredRents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: t.text }]}>No results</Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>Try a different search term or filter.</Text>
          </View>
        ) : (
          filteredRents.map(rent => (
            <RentCard
              key={rent.id}
              rent={rent}
              theme={t}
              onPress={() => showCardOptions(rent)}
              onPay={() => toggleStatus(rent)}
              onDelete={() => handleDelete(rent)}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: t.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>{editingRent ? 'Edit Rent Payment' : 'Add Rent Payment'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={[styles.modalClose, { color: t.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Month & Year</Text>
            <View style={styles.monthRow}>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                if (formMonth === 1) { setFormMonth(12); setFormYear(y => y - 1); } else setFormMonth(m => m - 1);
              }}><Text style={[styles.arrowText, { color: t.primary }]}>‹</Text></TouchableOpacity>
              <Text style={[styles.monthText, { color: t.text }]}>{MONTHS[formMonth - 1]} {formYear}</Text>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => {
                if (formMonth === 12) { setFormMonth(1); setFormYear(y => y + 1); } else setFormMonth(m => m + 1);
              }}><Text style={[styles.arrowText, { color: t.primary }]}>›</Text></TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Rent Amount (₹)</Text>
            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 15000"
              placeholderTextColor={t.textPlaceholder}
            />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: t.primary }]} onPress={saveRent}>
              <Text style={styles.saveBtnText}>{editingRent ? 'Update Rent' : 'Save Rent'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RentCard({ rent, theme: t, onPress, onPay, onDelete }: {
  rent: Rent; theme: Theme; onPress: () => void; onPay: () => void; onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const overdue = isOverdue(rent);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        {rent.status === 'unpaid' && (
          <TouchableOpacity style={styles.swipePayBtn} onPress={() => { swipeRef.current?.close(); onPay(); }}>
            <Text style={styles.swipePayText}>✓ Pay</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => { swipeRef.current?.close(); onDelete(); }}>
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: t.card }, overdue && { borderWidth: 1.5, borderColor: t.danger }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {overdue && <View style={[styles.overdueStripe, { backgroundColor: t.danger }]} />}
        <View style={styles.cardTop}>
          <View>
            <Text style={[styles.cardTitle, { color: t.text }]}>{MONTHS[rent.month - 1]} {rent.year}</Text>
            {overdue && <Text style={[styles.overdueLabel, { color: t.danger }]}>OVERDUE</Text>}
          </View>
          <View style={[styles.badge, rent.status === 'paid' ? { backgroundColor: t.successLight } : { backgroundColor: t.dangerLight }]}>
            <Text style={[styles.badgeText, { color: rent.status === 'paid' ? t.success : t.danger }]}>
              {rent.status === 'paid' ? 'PAID' : 'UNPAID'}
            </Text>
          </View>
        </View>

        <View style={[styles.amountRow, { backgroundColor: t.cardAlt }]}>
          <Text style={[styles.amountLabel, { color: t.textSub }]}>Rent Amount</Text>
          <Text style={[styles.amountValue, { color: t.primary }]}>₹{rent.amount.toLocaleString('en-IN')}</Text>
        </View>

        {rent.paid_date && (
          <Text style={[styles.paidDate, { color: t.success }]}>
            Paid on {new Date(rent.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}

        {rent.status === 'unpaid' && (
          <TouchableOpacity style={[styles.quickPayBtn, { backgroundColor: t.successBg, borderColor: t.success }]} onPress={onPay}>
            <Text style={[styles.quickPayText, { color: t.success }]}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { fontSize: 22, fontWeight: '700' },
  overdueBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  overdueBadgeText: { fontSize: 11, fontWeight: '700' },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  summaryBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4,
  },
  summaryText: { fontSize: 14, fontWeight: '600' },
  summaryAmount: { fontSize: 16, fontWeight: '700' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1.5,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600' },
  filterBtnTextActive: { color: '#FFFFFF' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden',
  },
  overdueStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  overdueLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12 },
  amountLabel: { fontSize: 13, fontWeight: '600' },
  amountValue: { fontSize: 20, fontWeight: '700' },
  paidDate: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  quickPayBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1 },
  quickPayText: { fontSize: 13, fontWeight: '700' },
  swipeActions: { flexDirection: 'row', marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  swipePayBtn: { backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', width: 70, paddingHorizontal: 8 },
  swipePayText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  swipeDeleteBtn: { backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', width: 70, paddingHorizontal: 8 },
  swipeDeleteText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalClose: { fontSize: 20, padding: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 28, fontWeight: '300' },
  monthText: { fontSize: 18, fontWeight: '700', minWidth: 160, textAlign: 'center' },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16 },
  saveBtn: { borderRadius: 14, padding: 16, marginTop: 24, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
