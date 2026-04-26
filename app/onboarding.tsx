import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { getSettings, updateSettings } from '@/lib/database';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: '🏡',
    title: 'Welcome to\nHome Manager',
    subtitle: 'Track electricity bills, rent payments and split costs — all in one place.',
  },
  {
    icon: '⚡',
    title: 'Track Bills & Rent',
    subtitle: 'Log monthly electricity bills with AI meter scanning, and track rent payments with one tap.',
  },
  {
    icon: '📊',
    title: 'Smart Analytics',
    subtitle: 'See spending trends, get AI insights, and split shared bills with auto-generated WhatsApp messages.',
  },
];

export default function OnboardingScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const db = useSQLiteContext();
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [apartmentName, setApartmentName] = useState('');

  const isLast = step === STEPS.length;

  async function finish() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const settings = await getSettings(db);
    await updateSettings(db, {
      ...settings,
      apartment_name: apartmentName.trim() || 'My Apartment',
    });
    router.replace('/(tabs)');
  }

  function next() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length) setStep(s => s + 1);
  }

  const s = STEPS[step];

  return (
    <View style={[styles.container, { backgroundColor: t.bg, paddingTop: top, paddingBottom: bottom + 20 }]}>
      {/* Progress dots */}
      <View style={styles.dots}>
        {[...Array(STEPS.length + 1)].map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? t.primary : t.border }]} />
        ))}
      </View>

      {!isLast ? (
        // Info steps
        <View style={styles.stepContent}>
          <Text style={styles.stepIcon}>{s.icon}</Text>
          <Text style={[styles.stepTitle, { color: t.text }]}>{s.title}</Text>
          <Text style={[styles.stepSubtitle, { color: t.textSub }]}>{s.subtitle}</Text>
        </View>
      ) : (
        // Setup step
        <View style={styles.stepContent}>
          <Text style={styles.stepIcon}>🏠</Text>
          <Text style={[styles.stepTitle, { color: t.text }]}>Name Your Apartment</Text>
          <Text style={[styles.stepSubtitle, { color: t.textSub }]}>This appears on your dashboard. You can change it anytime in Settings.</Text>
          <TextInput
            style={[styles.nameInput, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
            value={apartmentName}
            onChangeText={setApartmentName}
            placeholder="e.g. Sunrise Apartments"
            placeholderTextColor={t.textPlaceholder}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={finish}
          />
        </View>
      )}

      <View style={styles.bottomArea}>
        {!isLast ? (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: t.primary }]} onPress={next}>
            <Text style={styles.nextBtnText}>
              {step === STEPS.length - 1 ? "Let's Set Up →" : 'Next →'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: t.primary }]} onPress={finish}>
            <Text style={styles.nextBtnText}>Get Started</Text>
          </TouchableOpacity>
        )}
        {step === 0 && (
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: t.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 20, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepIcon: { fontSize: 80, marginBottom: 28 },
  stepTitle: { fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38, marginBottom: 16 },
  stepSubtitle: { fontSize: 17, textAlign: 'center', lineHeight: 26 },
  nameInput: {
    width: width - 56, marginTop: 24, borderWidth: 1.5, borderRadius: 14,
    padding: 16, fontSize: 18, fontWeight: '600', textAlign: 'center',
  },
  bottomArea: { paddingTop: 20 },
  nextBtn: { borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 },
  nextBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', padding: 8 },
  skipText: { fontSize: 15, fontWeight: '500' },
});
