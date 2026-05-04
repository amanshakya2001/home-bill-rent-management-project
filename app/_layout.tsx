import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { initDatabase } from '@/lib/database';
import { ErrorBoundary } from '@/components/error-boundary';

export const unstable_settings = { anchor: '(tabs)' };

function AppNavigator() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="home-manager.db" onInit={initDatabase}>
          <AppNavigator />
        </SQLiteProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
