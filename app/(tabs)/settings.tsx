import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { getSettings, updateApartmentName, getBills, getRentPayments, type AppSettings } from '@/lib/database';
import { useTheme } from '@/lib/theme';
import { buildCSV } from '@/lib/export';
import { logError } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';

export default function SettingsScreen() {
  const { top, bottom } = useSafeAreaInsets();
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
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: top + 20, paddingBottom: dirty ? bottom + 96 : bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.screenTitle, { color: t.text }]}>Settings</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSub }]}>Apartment</Text>
          <Card style={styles.cardNoPad}>
            <Text style={[styles.fieldLabel, { color: t.textSub }]}>Apartment Name</Text>
            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.inputBg }]}
              value={settings.apartment_name}
              onChangeText={v => update({ apartment_name: v })}
              placeholder="e.g. My Apartment"
              placeholderTextColor={t.textPlaceholder}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textSub }]}>Export Data</Text>
          <Card style={styles.cardNoPad}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: t.text }]}>Copy as CSV</Text>
                <Text style={[styles.rowSub, { color: t.textMuted }]}>Paste into Sheets or Excel</Text>
              </View>
              <View style={styles.yearRow}>
                <Pressable
                  onPress={() => setExportYear(y => y - 1)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.yearArrow, pressed && { opacity: 0.5 }]}
                >
                  <Text style={[styles.yearArrowText, { color: t.primary }]}>‹</Text>
                </Pressable>
                <Text style={[styles.yearValue, { color: t.text }]}>{exportYear}</Text>
                <Pressable
                  onPress={() => setExportYear(y => y + 1)}
                  disabled={exportYear >= now.getFullYear()}
                  hitSlop={8}
                  style={({ pressed }) => [styles.yearArrow, pressed && { opacity: 0.5 }]}
                >
                  <Text style={[styles.yearArrowText, { color: exportYear >= now.getFullYear() ? t.textPlaceholder : t.primary }]}>›</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.exportRow, { borderTopColor: t.border }]}>
              <PrimaryButton
                label={copied ? '✓ Copied to Clipboard' : 'Copy CSV'}
                onPress={handleCopyCSV}
                variant={copied ? 'success' : 'tonal'}
                size="md"
              />
            </View>
          </Card>
        </View>
      </ScrollView>

      {dirty && (
        <View style={[styles.saveBar, { paddingBottom: bottom + 12, backgroundColor: t.bg, borderTopColor: t.border }]}>
          <PrimaryButton label="Save Changes" onPress={save} size="lg" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  screenTitle: { fontSize: 26, fontWeight: '700', lineHeight: 32, marginBottom: 24, marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, lineHeight: 16 },
  cardNoPad: { padding: 0, overflow: 'hidden' },
  fieldLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  input: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, lineHeight: 22, minHeight: 48,
    marginHorizontal: 16, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  rowSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  yearArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  yearArrowText: { fontSize: 22, fontWeight: '300', lineHeight: 26 },
  yearValue: { fontSize: 15, fontWeight: '700', lineHeight: 20, minWidth: 40, textAlign: 'center' },
  exportRow: { borderTopWidth: 1, padding: 12 },
  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1,
  },
});
