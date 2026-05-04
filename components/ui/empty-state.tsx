import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/lib/theme';
import type { ComponentProps } from 'react';

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ComponentProps<typeof IconSymbol>['name'];
  title: string;
  description: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: t.cardAlt }]}>
        <IconSymbol name={icon} size={32} color={t.textSub} />
      </View>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 60 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 8, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 24 },
});
