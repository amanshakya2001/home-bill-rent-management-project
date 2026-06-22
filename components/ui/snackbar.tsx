import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

/**
 * Lightweight bottom snackbar with an optional action (e.g. "Undo").
 * Auto-dismisses after `duration`. `onDismiss` should be stable (useCallback).
 */
export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 4000,
}: {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}) {
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [visible, message, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={[styles.wrap, { bottom: bottom + 16 }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: t.text, shadowColor: t.shadow }]}>
        <Text style={[styles.msg, { color: t.bg }]} numberOfLines={2}>{message}</Text>
        {actionLabel && onAction && (
          <Pressable
            onPress={onAction}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={[styles.action, { color: t.primary }]}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'stretch', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    gap: 16, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  msg: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  action: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 18 },
});
