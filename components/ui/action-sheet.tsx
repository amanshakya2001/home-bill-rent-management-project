import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

export type ActionSheetItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ActionSheet({
  visible,
  onClose,
  title,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: t.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: t.card }]} onPress={() => {}}>
          {title && (
            <Text style={[styles.title, { color: t.textSub }]}>{title}</Text>
          )}
          {items.map((item, i) => (
            <Pressable
              key={i}
              onPress={() => { onClose(); item.onPress(); }}
              style={({ pressed }) => [
                styles.item,
                i < items.length - 1 && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                pressed && { backgroundColor: t.cardAlt },
              ]}
            >
              <Text
                style={[
                  styles.itemText,
                  { color: item.destructive ? t.danger : t.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: t.cardAlt },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.cancelText, { color: t.text }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  sheet: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  title: {
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 13, fontWeight: '600', textAlign: 'center',
  },
  item: { paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', minHeight: 52 },
  itemText: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  cancel: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', minHeight: 52,
  },
  cancelText: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
});
