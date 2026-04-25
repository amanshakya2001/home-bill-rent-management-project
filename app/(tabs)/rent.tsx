import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getRentPayments, addRentPayment, updateRentPayment, updateRentStatus,
  deleteRentPayment, saveRentNotificationId, getSettings, type Rent,
} from '@/lib/database';
import { scheduleDueNotification, cancelScheduledNotification } from '@/lib/notifications';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function RentScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [rents, setRents] = useState<Rent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRent, setEditingRent] = useState<Rent | null>(null);

  const now = new Date();
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('1');

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([getRentPayments(db), getSettings(db)]);
    setRents(r);
    setDueDay(String(s.rent_due_day));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openModal() {
    setEditingRent(null);
    const n = new Date();
    setFormMonth(n.getMonth() + 1);
    setFormYear(n.getFullYear());
    setAmount('');
    setShowModal(true);
  }

  function openEditModal(rent: Rent) {
    setEditingRent(rent);
    setFormMonth(rent.month);
    setFormYear(rent.year);
    setAmount(String(rent.amount));
    setDueDay(String(parseInt(rent.due_date.split('-')[2])));
    setShowModal(true);
  }

  function showCardOptions(rent: Rent) {
    Alert.alert(`${MONTHS_SHORT[rent.month - 1]} ${rent.year}`, 'Choose an action', [
      { text: 'Edit', onPress: () => openEditModal(rent) },
      {
        text: rent.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid',
        onPress: () => toggleStatus(rent),
      },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(rent) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function saveRent() {
    const a = parseFloat(amount);
    const day = parseInt(dueDay);

    if (!a || isNaN(a) || a <= 0) {
      Alert.alert('Error', 'Please enter a valid rent amount.');
      return;
    }
    if (!day || day < 1 || day > 31) {
      Alert.alert('Error', 'Please enter a valid due day (1–31).');
      return;
    }

    const dueDateStr = `${formYear}-${String(formMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (editingRent) {
      await updateRentPayment(db, editingRent.id, {
        month: formMonth, year: formYear, amount: a, due_date: dueDateStr,
      });
      const s = await getSettings(db);
      if (s.notifications_enabled && editingRent.status === 'unpaid') {
        if (editingRent.notification_id) await cancelScheduledNotification(editingRent.notification_id);
        const dueDate = new Date(formYear, formMonth - 1, day);
        const notifId = await scheduleDueNotification(
          'Rent Due',
          `₹${a.toLocaleString('en-IN')} rent due for ${MONTHS[formMonth - 1]} ${formYear}`,
          dueDate
        );
        if (notifId) await saveRentNotificationId(db, editingRent.id, notifId);
      }
    } else {
      const id = await addRentPayment(db, {
        month: formMonth, year: formYear,
        amount: a, due_date: dueDateStr, status: 'unpaid', paid_date: null,
      });
      const s = await getSettings(db);
      if (s.notifications_enabled) {
        const dueDate = new Date(formYear, formMonth - 1, day);
        const notifId = await scheduleDueNotification(
          'Rent Due',
          `₹${a.toLocaleString('en-IN')} rent due for ${MONTHS[formMonth - 1]} ${formYear}`,
          dueDate
        );
        if (notifId) await saveRentNotificationId(db, id, notifId);
      }
    }

    setEditingRent(null);
    setShowModal(false);
    load();
  }

  async function toggleStatus(rent: Rent) {
    const newStatus = rent.status === 'paid' ? 'unpaid' : 'paid';
    await updateRentStatus(db, rent.id, newStatus);
    if (newStatus === 'paid' && rent.notification_id) {
      await cancelScheduledNotification(rent.notification_id);
      await saveRentNotificationId(db, rent.id, null);
    }
    load();
  }

  function confirmDelete(rent: Rent) {
    Alert.alert(
      'Delete Rent',
      `Delete rent record for ${MONTHS_SHORT[rent.month - 1]} ${rent.year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (rent.notification_id) await cancelScheduledNotification(rent.notification_id);
            await deleteRentPayment(db, rent.id);
            load();
          },
        },
      ]
    );
  }

  const totalUnpaid = rents.filter(r => r.status === 'unpaid').reduce((s, r) => s + r.amount, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: top + 16 }]}>
        <Text style={styles.screenTitle}>Rent Payments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {totalUnpaid > 0 && (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryText}>Pending rent</Text>
          <Text style={styles.summaryAmount}>₹{totalUnpaid.toLocaleString('en-IN')}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {rents.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No rent records yet</Text>
            <Text style={styles.emptyText}>Tap "+ Add" to record your first rent payment.</Text>
          </View>
        )}
        {rents.map(rent => (
          <TouchableOpacity
            key={rent.id}
            style={styles.card}
            onPress={() => showCardOptions(rent)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardTitle}>{MONTHS[rent.month - 1]} {rent.year}</Text>
                <Text style={styles.cardSub}>Due {formatDate(rent.due_date)}</Text>
              </View>
              <View style={[styles.badge, rent.status === 'paid' ? styles.badgePaid : styles.badgeUnpaid]}>
                <Text style={[styles.badgeText, rent.status === 'paid' ? styles.textPaid : styles.textUnpaid]}>
                  {rent.status === 'paid' ? 'PAID' : 'UNPAID'}
                </Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Rent Amount</Text>
              <Text style={styles.amountValue}>₹{rent.amount.toLocaleString('en-IN')}</Text>
            </View>

            {rent.paid_date && (
              <Text style={styles.paidDate}>
                Paid on {new Date(rent.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}

            <Text style={styles.tapHint}>Tap for options</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRent ? 'Edit Rent Payment' : 'Add Rent Payment'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

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

            <Text style={styles.fieldLabel}>Rent Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 15000"
              placeholderTextColor="#D1D5DB"
            />

            <Text style={styles.fieldLabel}>Due Day (of month)</Text>
            <TextInput
              style={styles.input}
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="number-pad"
              placeholder="e.g. 1"
              placeholderTextColor="#D1D5DB"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={saveRent}>
              <Text style={styles.saveBtnText}>{editingRent ? 'Update Rent' : 'Save Rent'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(parts[2])} ${MONTHS_S[parseInt(parts[1]) - 1]} ${parts[0]}`;
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
  summaryBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEE2E2', marginHorizontal: 16, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4,
  },
  summaryText: { fontSize: 14, color: '#991B1B', fontWeight: '600' },
  summaryAmount: { fontSize: 16, color: '#991B1B', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeUnpaid: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  textPaid: { color: '#16A34A' },
  textUnpaid: { color: '#DC2626' },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12,
  },
  amountLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  amountValue: { fontSize: 20, fontWeight: '700', color: '#6366F1' },
  paidDate: { fontSize: 12, color: '#16A34A', marginTop: 8, fontStyle: 'italic' },
  tapHint: { fontSize: 11, color: '#D1D5DB', marginTop: 10, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#D1D5DB', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
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
  saveBtn: { backgroundColor: '#6366F1', borderRadius: 14, padding: 16, marginTop: 24, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
