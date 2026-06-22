import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/lib/theme';

/**
 * Shown when a data load fails (e.g. the device is offline and can't reach
 * Supabase). Makes "no connection" visibly different from "no data".
 */
export function ErrorBanner({
  message = "Couldn't reach the server. Check your connection and try again.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: t.dangerLight }]}>
        <IconSymbol name="exclamationmark.triangle.fill" size={30} color={t.danger} />
      </View>
      <Text style={[styles.title, { color: t.text }]}>Something went wrong</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading"
        style={({ pressed }) => [styles.btn, { backgroundColor: t.primaryLight }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.btnText, { color: t.primaryText }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 8, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  btn: { borderRadius: 10, paddingHorizontal: 24, minHeight: 44, justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
});
