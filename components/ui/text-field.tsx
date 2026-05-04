import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/lib/theme';

export function TextField({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View>
      {label && <Text style={[styles.label, { color: t.textSub }]}>{label}</Text>}
      <TextInput
        {...props}
        style={[
          styles.input,
          {
            borderColor: t.border,
            color: t.text,
            backgroundColor: t.inputBg,
          },
          props.style,
        ]}
        placeholderTextColor={props.placeholderTextColor ?? t.textPlaceholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 48,
  },
});
