import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  cardAlt: '#F9FAFB',
  border: '#E5E7EB',
  borderFocus: '#6366F1',
  text: '#111827',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',
  textPlaceholder: '#D1D5DB',
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  primaryDark: '#4338CA',
  success: '#16A34A',
  successLight: '#DCFCE7',
  successBg: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  inputBg: '#FAFAFA',
  tabBar: '#FFFFFF',
  tabBorder: '#E5E7EB',
  shadow: '#000',
  // Chart palette
  chartBillPaid: '#6366F1',
  chartBillUnpaid: '#FCA5A5',
  chartUnits: '#10B981',
  chartRentPaid: '#0EA5E9',
  chartRentUnpaid: '#FCA5A5',
  chartAccentAmber: '#F59E0B',
  chartAccentBlue: '#0EA5E9',
  chartAccentGreen: '#16A34A',
  chartAccentRed: '#DC2626',
};

export const dark = {
  bg: '#0F172A',
  card: '#1E293B',
  cardAlt: '#0F172A',
  border: '#334155',
  borderFocus: '#818CF8',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  textMuted: '#64748B',
  textPlaceholder: '#475569',
  primary: '#818CF8',
  primaryLight: '#1E1B4B',
  primaryDark: '#A5B4FC',
  success: '#4ADE80',
  successLight: '#14532D',
  successBg: '#052E16',
  danger: '#F87171',
  dangerLight: '#450A0A',
  warning: '#FCD34D',
  warningLight: '#451A03',
  inputBg: '#1E293B',
  tabBar: '#1E293B',
  tabBorder: '#334155',
  shadow: '#000',
  // Chart palette (lighter variants for dark mode contrast)
  chartBillPaid: '#A5B4FC',
  chartBillUnpaid: '#FCA5A5',
  chartUnits: '#4ADE80',
  chartRentPaid: '#7DD3FC',
  chartRentUnpaid: '#FCA5A5',
  chartAccentAmber: '#FCD34D',
  chartAccentBlue: '#7DD3FC',
  chartAccentGreen: '#4ADE80',
  chartAccentRed: '#F87171',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
