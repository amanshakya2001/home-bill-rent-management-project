import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

export function ScreenHeader({
  title,
  trailing,
  meta,
  style,
}: {
  title: string;
  trailing?: ReactNode;
  meta?: ReactNode;
  style?: ViewStyle;
}) {
  const { top } = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { paddingTop: top + 12, backgroundColor: t.bg },
        style,
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
        {meta}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
