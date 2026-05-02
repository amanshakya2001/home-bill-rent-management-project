import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logError } from '@/lib/logger';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('ErrorBoundary', error.message, { stack: error.stack, componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>The app hit an unexpected error. You can try again or restart the app.</Text>
        <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.errorText} selectable>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </Text>
        </ScrollView>
        <TouchableOpacity style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  errorBox: { width: '100%', maxHeight: 240, backgroundColor: '#FEE2E2', borderRadius: 12, marginBottom: 16 },
  errorText: { fontSize: 11, color: '#991B1B', fontFamily: 'Courier' },
  btn: { backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
