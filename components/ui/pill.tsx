import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme, type Theme } from '@/lib/theme';

type Variant = 'success' | 'danger' | 'warning' | 'primary' | 'neutral';
type Size = 'sm' | 'md';

const variantBg = (t: Theme, v: Variant) => ({
  success: t.successLight,
  danger: t.dangerLight,
  warning: t.warningLight,
  primary: t.primaryLight,
  neutral: t.cardAlt,
}[v]);

const variantText = (t: Theme, v: Variant) => ({
  success: t.successText,
  danger: t.dangerText,
  warning: t.warningText,
  primary: t.primaryText,
  neutral: t.textSub,
}[v]);

export function Pill({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}: {
  label: string;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isSm = size === 'sm';
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: variantBg(t, variant) },
        isSm ? styles.sm : styles.md,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSm ? styles.textSm : styles.textMd,
          { color: variantText(t, variant) },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 8, alignSelf: 'flex-start' },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontWeight: '700', letterSpacing: 0.5 },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
});
