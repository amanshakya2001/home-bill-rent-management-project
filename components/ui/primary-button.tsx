import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Variant = 'primary' | 'success' | 'danger' | 'tonal';
type Size = 'md' | 'lg';

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg = {
    primary: t.primary,
    success: t.success,
    danger: t.danger,
    tonal: t.primaryLight,
  }[variant];
  const fg = variant === 'tonal' ? t.primaryText : '#FFFFFF';
  const isLg = size === 'lg';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        isLg ? styles.lg : styles.md,
        pressed && !disabled && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={fg} />
          <Text style={[styles.text, isLg ? styles.textLg : styles.textMd, { color: fg }]}>
            {label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.text, isLg ? styles.textLg : styles.textMd, { color: fg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
  lg: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontWeight: '700' },
  textMd: { fontSize: 15, lineHeight: 20 },
  textLg: { fontSize: 16, lineHeight: 22 },
});
