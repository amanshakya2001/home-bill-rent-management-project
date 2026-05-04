import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { markOnboardingDone, updateApartmentName } from '@/lib/database';
import { useTheme } from '@/lib/theme';
import { logError } from '@/lib/logger';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';

const STEPS = [
  {
    icon: 'house.fill' as const,
    title: 'Welcome to Home Manager',
    subtitle: 'Track electricity bills, rent payments and split costs — all in one place.',
  },
  {
    icon: 'bolt.fill' as const,
    title: 'Track Bills & Rent',
    subtitle: 'Log monthly electricity bills with AI meter scanning, and track rent payments with one tap.',
  },
  {
    icon: 'chart.bar.fill' as const,
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
    try {
      const trimmed = apartmentName.trim();
      if (trimmed) await updateApartmentName(db, trimmed);
      await markOnboardingDone(db);
    } catch (err) {
      logError('onboarding.finish', 'Failed to save settings', err);
    }
    router.replace('/(tabs)');
  }

  function next() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length) setStep(s => s + 1);
  }

  async function skip() {
    try { await markOnboardingDone(db); } catch (err) { logError('onboarding.skip', 'Failed to mark done', err); }
    router.replace('/(tabs)');
  }

  const s = STEPS[step];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: t.bg, paddingTop: top, paddingBottom: bottom + 20 }]}
    >
      <View style={styles.dots}>
        {[...Array(STEPS.length + 1)].map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? t.primary : t.border }]} />
        ))}
      </View>

      {!isLast ? (
        <View style={styles.stepContent}>
          <View style={[styles.iconWrap, { backgroundColor: t.primaryLight }]}>
            <IconSymbol name={s.icon} size={56} color={t.primary} />
          </View>
          <Text style={[styles.stepTitle, { color: t.text }]}>{s.title}</Text>
          <Text style={[styles.stepSubtitle, { color: t.textSub }]}>{s.subtitle}</Text>
        </View>
      ) : (
        <View style={styles.stepContent}>
          <View style={[styles.iconWrap, { backgroundColor: t.primaryLight }]}>
            <IconSymbol name="house.fill" size={56} color={t.primary} />
          </View>
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
        <PrimaryButton
          label={isLast ? 'Get Started' : step === STEPS.length - 1 ? "Let's Set Up" : 'Next'}
          onPress={isLast ? finish : next}
          size="lg"
        />
        {!isLast && (
          <Pressable
            onPress={skip}
            hitSlop={12}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={[styles.skipText, { color: t.textMuted }]}>Skip</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 20, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconWrap: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 26, fontWeight: '700', textAlign: 'center',
    lineHeight: 32, marginBottom: 16, paddingHorizontal: 8,
  },
  stepSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  nameInput: {
    alignSelf: 'stretch', marginTop: 24, borderWidth: 1.5, borderRadius: 14,
    padding: 16, fontSize: 17, fontWeight: '600', textAlign: 'center',
    minHeight: 56,
  },
  bottomArea: { paddingTop: 20 },
  skipBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8, minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
});
