import { useColorScheme } from 'react-native';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const type = {
  caption:    { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  body:       { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold:   { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  title:      { fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  amount:     { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  screenTitle:{ fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  display:    { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  overline:   { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

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
  primaryText: '#3730A3',
  success: '#16A34A',
  successLight: '#DCFCE7',
  successBg: '#F0FDF4',
  successText: '#15803D',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  dangerText: '#991B1B',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  inputBg: '#FAFAFA',
  tabBar: '#FFFFFF',
  tabBorder: '#E5E7EB',
  shadow: '#000',
  overlay: 'rgba(0,0,0,0.4)',
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
  // Chart text variants (darker for AA contrast on white card)
  chartUnitsText: '#047857',
  chartAccentAmberText: '#92400E',
  chartAccentBlueText: '#0369A1',
  chartAccentGreenText: '#15803D',
};

export const dark = {
  bg: '#0F172A',
  card: '#1E293B',
  cardAlt: '#172033',
  border: '#334155',
  borderFocus: '#818CF8',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  textMuted: '#64748B',
  textPlaceholder: '#475569',
  primary: '#818CF8',
  primaryLight: '#1E1B4B',
  primaryDark: '#A5B4FC',
  primaryText: '#C7D2FE',
  success: '#4ADE80',
  successLight: '#14532D',
  successBg: '#052E16',
  successText: '#86EFAC',
  danger: '#F87171',
  dangerLight: '#450A0A',
  dangerText: '#FCA5A5',
  warning: '#FCD34D',
  warningLight: '#451A03',
  warningText: '#FDE68A',
  inputBg: '#1E293B',
  tabBar: '#1E293B',
  tabBorder: '#334155',
  shadow: '#000',
  overlay: 'rgba(0,0,0,0.6)',
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
  // Chart text variants (already light enough on dark cards)
  chartUnitsText: '#86EFAC',
  chartAccentAmberText: '#FDE68A',
  chartAccentBlueText: '#BAE6FD',
  chartAccentGreenText: '#86EFAC',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
