import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSettings, updateSettings, type AppSettings } from '@/lib/database';

export default function SettingsScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings>({
    apartment_name: 'My Apartment',
    bill_due_day: 10,
    rent_due_day: 1,
    notifications_enabled: 1,
  });
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const s = await getSettings(db);
    setSettings(s);
    setDirty(false);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function update(patch: Partial<AppSettings>) {
    setSettings(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  async function save() {
    const billDay = settings.bill_due_day;
    const rentDay = settings.rent_due_day;

    if (!settings.apartment_name.trim()) {
      Alert.alert('Error', 'Apartment name cannot be empty.');
      return;
    }
    if (billDay < 1 || billDay > 31) {
      Alert.alert('Error', 'Bill due day must be between 1 and 31.');
      return;
    }
    if (rentDay < 1 || rentDay > 31) {
      Alert.alert('Error', 'Rent due day must be between 1 and 31.');
      return;
    }

    await updateSettings(db, settings);
    setDirty(false);
    Alert.alert('Saved', 'Settings updated successfully.');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}>
      <Text style={styles.screenTitle}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apartment</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Apartment Name</Text>
          <TextInput
            style={styles.input}
            value={settings.apartment_name}
            onChangeText={v => update({ apartment_name: v })}
            placeholder="e.g. My Apartment"
            placeholderTextColor="#D1D5DB"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Due Days</Text>
        <Text style={styles.sectionSubtitle}>
          These are pre-filled when you add a new entry. You can still change them per entry.
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Electricity Bill Due Day</Text>
              <Text style={styles.rowSub}>Day of month (1–31)</Text>
            </View>
            <TextInput
              style={styles.dayInput}
              value={String(settings.bill_due_day)}
              onChangeText={v => update({ bill_due_day: parseInt(v) || 1 })}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Rent Due Day</Text>
              <Text style={styles.rowSub}>Day of month (1–31)</Text>
            </View>
            <TextInput
              style={styles.dayInput}
              value={String(settings.rent_due_day)}
              onChangeText={v => update({ rent_due_day: parseInt(v) || 1 })}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Enable Notifications</Text>
              <Text style={styles.rowSub}>Reminder 1 day before due date</Text>
            </View>
            <Switch
              value={settings.notifications_enabled === 1}
              onValueChange={v => update({ notifications_enabled: v ? 1 : 0 })}
              trackColor={{ false: '#E5E7EB', true: '#A5B4FC' }}
              thumbColor={settings.notifications_enabled === 1 ? '#6366F1' : '#9CA3AF'}
            />
          </View>
        </View>
      </View>

      {dirty && (
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, paddingBottom: 60 },
  screenTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 24, marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, color: '#9CA3AF', marginBottom: 10, lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', padding: 16, paddingBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#FAFAFA',
    marginHorizontal: 16, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  dayInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 10, fontSize: 18, fontWeight: '700', color: '#6366F1',
    textAlign: 'center', width: 56, backgroundColor: '#FAFAFA',
  },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  saveBtn: {
    backgroundColor: '#6366F1', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
