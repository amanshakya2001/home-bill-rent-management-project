import { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useTheme } from '@/lib/theme';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = '92%',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxHeight?: `${number}%`;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: t.overlay }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.card, maxHeight }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}
            >
              <Text style={[styles.closeText, { color: t.textMuted }]}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20, fontWeight: '400', lineHeight: 24 },
});
