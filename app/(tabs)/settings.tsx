import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { getSettings, updateApartmentName, getBills, getRentPayments, type AppSettings } from '@/lib/database';
import { useTheme } from '@/lib/theme';
import { buildCSV } from '@/lib/export';
import { logError } from '@/lib/logger';

export default function SettingsScreen() {
  const { top } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const t = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    apartment_name: 'My Apartment',
    onboarding_done: 1,
  });
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const [exportYear, setExportYear] = useState(now.getFullYear());

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const s = await getSettings(db);
      if (signal?.cancelled) return;
      setSettings(s);
      setDirty(false);
    } catch (err) {
      logError('Settings.load', 'Failed to load settings', err);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]));

  function update(patch: Partial<AppSettings>) {
    setSettings(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  async function handleCopyCSV() {
    try {
      const [bills, rents] = await Promise.all([getBills(db), getRentPayments(db)]);
      const csv = buildCSV(bills, rents, settings, exportYear);
      await Clipboard.setStringAsync(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Unknown error');
    }
  }

  async function save() {
    if (!settings.apartment_name.trim()) {
      Alert.alert('Error', 'Apartment name cannot be empty.');
      return;
    }
    try {
      await updateApartmentName(db, settings.apartment_name.trim());
      setDirty(false);
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (err) {
      logError('settings.save', 'Failed to update apartment name', err);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}
    >
      <Text style={[styles.screenTitle, { color: t.text }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSub }]}>Apartment</Text>
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.fieldLabel, { color: t.textSub }]}>Apartment Name</Text>
          <TextInput
            style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
            value={settings.apartment_name}
            onChangeText={v => update({ apartment_name: v })}
            placeholder="e.g. My Apartment"
            placeholderTextColor={t.textPlaceholder}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSub }]}>Export Data</Text>
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, { color: t.text }]}>Copy as CSV</Text>
              <Text style={[styles.rowSub, { color: t.textMuted }]}>Paste into Sheets or Excel</Text>
            </View>
            <View style={styles.yearRow}>
              <TouchableOpacity onPress={() => setExportYear(y => y - 1)} style={styles.yearArrow}>
                <Text style={[styles.yearArrowText, { color: t.primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.yearValue, { color: t.text }]}>{exportYear}</Text>
              <TouchableOpacity
                onPress={() => setExportYear(y => y + 1)}
                style={styles.yearArrow}
                disabled={exportYear >= now.getFullYear()}
              >
                <Text style={[styles.yearArrowText, { color: exportYear >= now.getFullYear() ? t.textPlaceholder : t.primary }]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.exportRow, { borderTopColor: t.border }]}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: copied ? t.successLight : t.primaryLight }]}
              onPress={handleCopyCSV}
            >
              <Text style={[styles.exportBtnText, { color: copied ? t.success : t.primary }]}>
                {copied ? '✓ Copied to Clipboard' : 'Copy CSV'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {dirty && (
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: t.primary }]} onPress={save}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  screenTitle: { fontSize: 26, fontWeight: '700', marginBottom: 24, marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  card: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', padding: 16, paddingBottom: 6 },
  input: {
    borderWidth: 1.5, borderRadius: 10,
    padding: 12, fontSize: 16,
    marginHorizontal: 16, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  yearArrow: { padding: 6 },
  yearArrowText: { fontSize: 22, fontWeight: '300' },
  yearValue: { fontSize: 15, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  exportRow: { borderTopWidth: 1, padding: 12 },
  exportBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  exportBtnText: { fontSize: 14, fontWeight: '700' },
});
