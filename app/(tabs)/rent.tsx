import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import {
  getRentPayments, addRentPayment, updateRentPayment, updateRentStatus,
  deleteRentPayment, getLastRentAmount, type Rent,
} from '@/lib/database';
import { useTheme, type Theme } from '@/lib/theme';
import { isOverdue as isOverdueShared } from '@/lib/dates';
import { logError } from '@/lib/logger';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Pill } from '@/components/ui/pill';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { MonthYearStepper } from '@/components/ui/month-year-stepper';
import { ActionSheet, type ActionSheetItem } from '@/components/ui/action-sheet';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
] as const;

const isOverdue = (r: Rent) => isOverdueShared(r.month, r.year, r.status);

export default function RentScreen() {
  const t = useTheme();
  const [rents, setRents] = useState<Rent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRent, setEditingRent] = useState<Rent | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [actionRent, setActionRent] = useState<Rent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const now = new Date();
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState('');

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await getRentPayments();
      if (signal?.cancelled) return;
      setRents(data);
      setError(false);
    } catch (err) {
      logError('Rent.load', 'Failed to load rent payments', err);
      if (!signal?.cancelled) setError(true);
    } finally {
      if (!signal?.cancelled) setLoading(false);
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
      const last = await getLastRentAmount();
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
    const dup = rents.some(r => r.month === formMonth && r.year === formYear && r.id !== editingRent?.id);
    if (dup) {
      Alert.alert('Already added', `Rent for ${MONTHS[formMonth - 1]} ${formYear} already exists. Edit that entry instead.`);
      return;
    }
    try {
      if (editingRent) {
        await updateRentPayment(editingRent.id, { month: formMonth, year: formYear, amount: a });
      } else {
        await addRentPayment({ month: formMonth, year: formYear, amount: a, status: 'unpaid', paid_date: null });
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
      await updateRentStatus(rent.id, newStatus);
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
          await deleteRentPayment(rent.id);
          load();
        },
      },
    ]);
  }

  function buildActionItems(rent: Rent): ActionSheetItem[] {
    return [
      { label: 'Edit', onPress: () => openEditModal(rent) },
      { label: rent.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid', onPress: () => toggleStatus(rent) },
      { label: 'Delete', destructive: true, onPress: () => handleDelete(rent) },
    ];
  }

  const totalUnpaid = rents.filter(r => r.status === 'unpaid').reduce((s, r) => s + r.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScreenHeader
        title="Rent Payments"
        meta={overdueCount > 0 && <Pill label={`${overdueCount} overdue`} variant="danger" size="sm" />}
        trailing={<PrimaryButton label="+ Add" onPress={openModal} size="md" />}
      />

      {totalUnpaid > 0 && (
        <View style={[styles.summaryBanner, { backgroundColor: t.dangerLight, borderLeftColor: t.danger }]}>
          <Text style={[styles.summaryText, { color: t.dangerText }]}>Pending rent</Text>
          <Text style={[styles.summaryAmount, { color: t.dangerText }]}>₹{totalUnpaid.toLocaleString('en-IN')}</Text>
        </View>
      )}

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
        {loading && rents.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="large" color={t.primary} />
        ) : error && rents.length === 0 ? (
          <ErrorBanner onRetry={() => { setLoading(true); load(); }} />
        ) : rents.length === 0 ? (
          <EmptyState
            icon="house.fill"
            title="No rent records yet"
            description="Record your first rent payment and track its monthly status."
            actionLabel="+ Add your first rent"
            onAction={openModal}
          />
        ) : filteredRents.length === 0 ? (
          <EmptyState
            icon="magnifyingglass"
            title="No results"
            description="Try a different search term or filter."
          />
        ) : (
          filteredRents.map(rent => (
            <RentCard
              key={rent.id}
              rent={rent}
              theme={t}
              onPress={() => setActionRent(rent)}
              onPay={() => toggleStatus(rent)}
              onDelete={() => handleDelete(rent)}
            />
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingRent ? 'Edit Rent Payment' : 'Add Rent Payment'}
      >
        <Text style={[styles.fieldLabel, { color: t.textSub }]}>Month & Year</Text>
        <MonthYearStepper
          month={formMonth}
          year={formYear}
          onChange={(m, y) => { setFormMonth(m); setFormYear(y); }}
        />

        <Text style={[styles.fieldLabel, { color: t.textSub }]}>Rent Amount (₹)</Text>
        <TextInput
          style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 15000"
          placeholderTextColor={t.textPlaceholder}
        />

        <PrimaryButton
          label={editingRent ? 'Update Rent' : 'Save Rent'}
          onPress={saveRent}
          size="lg"
          style={{ marginTop: 24 }}
        />
      </BottomSheet>

      <ActionSheet
        visible={!!actionRent}
        onClose={() => setActionRent(null)}
        title={actionRent ? `${MONTHS_SHORT[actionRent.month - 1]} ${actionRent.year}` : undefined}
        items={actionRent ? buildActionItems(actionRent) : []}
      />
    </View>
  );
}

function RentCard({
  rent, theme: t, onPress, onPay, onDelete,
}: {
  rent: Rent; theme: Theme; onPress: () => void; onPay: () => void; onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const overdue = isOverdue(rent);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}>
        {rent.status === 'unpaid' && (
          <Pressable
            style={[styles.swipeBtn, { backgroundColor: t.success }]}
            onPress={() => { swipeRef.current?.close(); onPay(); }}
          >
            <Text style={styles.swipeText}>✓ Pay</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.swipeBtn, { backgroundColor: t.danger }]}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
        >
          <Text style={styles.swipeText}>Delete</Text>
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
            <Text style={[styles.cardTitle, { color: t.text }]}>{MONTHS[rent.month - 1]} {rent.year}</Text>
          </View>
          <Pill
            label={rent.status === 'paid' ? 'PAID' : overdue ? 'OVERDUE' : 'UNPAID'}
            variant={rent.status === 'paid' ? 'success' : 'danger'}
          />
        </View>

        <View style={[styles.amountRow, { backgroundColor: t.cardAlt }]}>
          <Text style={[styles.amountLabel, { color: t.textSub }]}>Rent Amount</Text>
          <Text style={[styles.amountValue, { color: t.text }]}>₹{rent.amount.toLocaleString('en-IN')}</Text>
        </View>

        {rent.paid_date && (
          <Text style={[styles.paidDate, { color: t.successText }]}>
            Paid on {new Date(rent.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}

        {rent.status === 'unpaid' && (
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
  summaryBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 12, borderLeftWidth: 4,
  },
  summaryText: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  summaryAmount: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden',
  },
  overdueStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12 },
  amountLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  amountValue: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  paidDate: { fontSize: 12, lineHeight: 16, marginTop: 8, fontStyle: 'italic' },
  swipeActions: { flexDirection: 'row', marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  swipeBtn: { justifyContent: 'center', alignItems: 'center', width: 70 },
  swipeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 22, minHeight: 48 },
});
