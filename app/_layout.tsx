import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { initDatabase, getSettings } from '@/lib/database';
import { useSQLiteContext } from 'expo-sqlite';

export const unstable_settings = { anchor: '(tabs)' };

function AppNavigator() {
  const db = useSQLiteContext();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSettings(db);
      // Show onboarding only if apartment name is still the default
      if (s.apartment_name === 'My Apartment') {
        router.replace('/onboarding');
      }
      setChecked(true);
    })();
  }, [db]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="home-manager.db" onInit={initDatabase}>
        <AppNavigator />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
