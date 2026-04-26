import type { Bill, Rent, AppSettings } from './database';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function buildCSV(
  bills: Bill[],
  rents: Rent[],
  settings: AppSettings,
  year: number,
): string {
  const yearBills = bills.filter(b => b.year === year).sort((a, b) => a.month - b.month);
  const yearRents = rents.filter(r => r.year === year).sort((a, b) => a.month - b.month);

  const totalBillPaid = yearBills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_amount, 0);
  const totalRentPaid = yearRents.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);

  const lines: string[] = [
    `${settings.apartment_name} - ${year} Statement`,
    `Generated: ${new Date().toLocaleDateString('en-IN')}`,
    '',
    'Type,Month,Units,Rate (INR),Amount (INR),Status,Paid On',
    ...yearBills.map(b =>
      `Electricity,${MONTHS[b.month - 1]},${b.units_consumed.toFixed(0)},${b.price_per_unit.toFixed(2)},${b.total_amount.toFixed(2)},${b.status},${b.paid_date ? new Date(b.paid_date).toLocaleDateString('en-IN') : ''}`
    ),
    ...yearRents.map(r =>
      `Rent,${MONTHS[r.month - 1]},,,${r.amount.toFixed(2)},${r.status},${r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-IN') : ''}`
    ),
    '',
    `Total Electricity Paid,${totalBillPaid.toFixed(2)}`,
    `Total Rent Paid,${totalRentPaid.toFixed(2)}`,
    `Grand Total,${(totalBillPaid + totalRentPaid).toFixed(2)}`,
  ];

  return lines.join('\n');
}
