import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function MonthYearStepper({
  month,
  year,
  onChange,
  short,
}: {
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
  short?: boolean;
}) {
  const t = useTheme();
  const labelMonths = short ? MONTHS.map(m => m.slice(0, 3)) : MONTHS;

  function prev() {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  }
  function next() {
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={prev}
        hitSlop={12}
        style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]}
      >
        <Text style={[styles.arrowText, { color: t.primary }]}>‹</Text>
      </Pressable>
      <Text style={[styles.label, { color: t.text }]}>
        {labelMonths[month - 1]} {year}
      </Text>
      <Pressable
        onPress={next}
        hitSlop={12}
        style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]}
      >
        <Text style={[styles.arrowText, { color: t.primary }]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  label: { fontSize: 18, fontWeight: '700', lineHeight: 24, minWidth: 160, textAlign: 'center' },
});
