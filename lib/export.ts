import type { Bill, Rent, AppSettings, SplitRecord } from './database';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

export function buildCSV(
  bills: Bill[],
  rents: Rent[],
  settings: AppSettings,
  year: number,
  splits: SplitRecord[] = [],
): string {
  const yearBills = bills.filter(b => b.year === year).sort((a, b) => a.month - b.month);
  const yearRents = rents.filter(r => r.year === year).sort((a, b) => a.month - b.month);

  const totalBillPaid = yearBills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_amount, 0);
  const totalRentPaid = yearRents.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);

  const lines: string[] = [
    csvRow([`${settings.apartment_name} - ${year} Statement`]),
    csvRow([`Generated: ${new Date().toLocaleDateString('en-IN')}`]),
    '',
    csvRow(['Type', 'Month', 'Units', 'Rate (INR)', 'Amount (INR)', 'Status', 'Paid On']),
    ...yearBills.map(b => csvRow([
      'Electricity',
      MONTHS[b.month - 1],
      b.units_consumed.toFixed(0),
      b.price_per_unit.toFixed(2),
      b.total_amount.toFixed(2),
      b.status,
      b.paid_date ? new Date(b.paid_date).toLocaleDateString('en-IN') : '',
    ])),
    ...yearRents.map(r => csvRow([
      'Rent',
      MONTHS[r.month - 1],
      '',
      '',
      r.amount.toFixed(2),
      r.status,
      r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-IN') : '',
    ])),
    '',
    csvRow(['Total Electricity Paid', totalBillPaid.toFixed(2)]),
    csvRow(['Total Rent Paid', totalRentPaid.toFixed(2)]),
    csvRow(['Grand Total', (totalBillPaid + totalRentPaid).toFixed(2)]),
  ];

  if (splits.length > 0) {
    lines.push(
      '',
      csvRow(['Bill Splits']),
      csvRow(['Period', 'Total (INR)', 'Per Unit', 'Our Units', 'Our Amount', 'Top Floor Units', 'Top Floor Amount', 'Underground Units', 'Underground Amount']),
      ...splits.map(s => csvRow([
        s.period,
        s.total_amount.toFixed(2),
        s.per_unit.toFixed(2),
        s.our_units.toFixed(0), s.our_amount.toFixed(2),
        s.top_floor_units.toFixed(0), s.top_floor_amount.toFixed(2),
        s.underground_units.toFixed(0), s.underground_amount.toFixed(2),
      ])),
    );
  }

  return lines.join('\n');
}
