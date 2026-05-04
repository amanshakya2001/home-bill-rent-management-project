import { useCallback, useEffect, useState } from 'react';
import { Redirect, Tabs, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getBills, getRentPayments, initialOnboardingDone } from '@/lib/database';
import { isOverdue } from '@/lib/dates';
import { logError } from '@/lib/logger';
import { useTheme } from '@/lib/theme';

export default function TabLayout() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [billBadge, setBillBadge] = useState(0);
  const [rentBadge, setRentBadge] = useState(0);

  const loadBadges = useCallback(async () => {
    try {
      const [bills, rents] = await Promise.all([getBills(db), getRentPayments(db)]);
      setBillBadge(bills.filter(b => isOverdue(b.month, b.year, b.status)).length);
      setRentBadge(rents.filter(r => isOverdue(r.month, r.year, r.status)).length);
    } catch (err) {
      logError('TabLayout.loadBadges', 'Failed to load badge counts', err);
    }
  }, [db]);

  useEffect(() => { loadBadges(); }, [loadBadges]);
  useFocusEffect(useCallback(() => { loadBadges(); }, [loadBadges]));

  if (!initialOnboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: t.tabBar,
          borderTopColor: t.tabBorder,
          elevation: 8,
          shadowOpacity: 0.1,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Electricity',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="bolt.fill" color={color} />,
          tabBarBadge: billBadge > 0 ? billBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: t.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="rent"
        options={{
          title: 'Rent',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="building.2.fill" color={color} />,
          tabBarBadge: rentBadge > 0 ? rentBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: t.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="split"
        options={{
          title: 'Split',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
