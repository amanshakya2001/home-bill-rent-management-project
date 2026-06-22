import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { loadInitialState } from '@/lib/database';
import { ErrorBoundary } from '@/components/error-boundary';

export const unstable_settings = { anchor: '(tabs)' };

// Hold the native splash screen until onboarding state has loaded from Supabase,
// so the user never sees a blank white flash while the first request is in flight.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Fetch onboarding state from Supabase before rendering the navigator,
    // so the tab layout can decide whether to redirect to onboarding.
    loadInitialState().finally(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    });
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppNavigator />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
