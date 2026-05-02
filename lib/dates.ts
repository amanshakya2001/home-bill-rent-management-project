export function isOverdue(month: number, year: number, status: string): boolean {
  if (status === 'paid') return false;
  const now = new Date();
  const itemStart = new Date(year, month - 1, 1);
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return itemStart < currentStart;
}

export function safeParseFloat(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function safeNumber(n: number | null | undefined): number {
  return n != null && Number.isFinite(n) ? n : 0;
}
