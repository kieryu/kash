import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';
import { CardIcon, HomeIcon, PlanIcon, SettingsIcon } from '@/ui/icons';

const { colors, radius, type } = theme;

// Active tab: icon sits in a soft green pill.
function icon(Icon: (p: { size: number; color: string }) => ReactNode) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View style={[styles.pill, focused && styles.pillOn]}>
        <Icon size={22} color={focused ? colors.primary : colors.muted} />
      </View>
    );
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { ...type.captionBold, marginTop: 2 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(HomeIcon) }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon(PlanIcon) }} />
      {/* "wallet": /debts is taken by onboarding step 05. */}
      <Tabs.Screen name="wallet" options={{ title: 'Debts', tabBarIcon: icon(CardIcon) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon(SettingsIcon) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 52, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.primarySoft },
});
