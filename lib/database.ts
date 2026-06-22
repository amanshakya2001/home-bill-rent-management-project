import { supabase } from './supabase';
import { logError } from './logger';

// Set by loadInitialState() so the tab layout can gate onboarding without a render-time await.
export let initialOnboardingDone = false;

export type Bill = {
  id: number;
  month: number;
  year: number;
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
  price_per_unit: number;
  total_amount: number;
  status: 'paid' | 'unpaid';
  paid_date: string | null;
  image_uri: string | null;
};

export type Rent = {
  id: number;
  month: number;
  year: number;
  amount: number;
  status: 'paid' | 'unpaid';
  paid_date: string | null;
};

export type AppSettings = {
  apartment_name: string;
  onboarding_done: number;
};

export type SplitRecord = {
  id: number;
  period: string;
  total_amount: number;
  total_units: number;
  per_unit: number;
  our_units: number;
  our_amount: number;
  top_floor_units: number;
  top_floor_amount: number;
  underground_units: number;
  underground_amount: number;
  created_at: string;
};

const SETTINGS_ID = 1;
const DEFAULT_SETTINGS: AppSettings = { apartment_name: 'My Apartment', onboarding_done: 0 };

// Loads cached state the rest of the app reads synchronously. Call once on app start.
export async function loadInitialState(): Promise<void> {
  try {
    const settings = await getSettings();
    initialOnboardingDone = settings.onboarding_done === 1;
  } catch (err) {
    logError('database.loadInitialState', 'Failed to load initial settings', err);
    initialOnboardingDone = false;
  }
}

// Bills
export async function getLastBillReading(): Promise<number | null> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .select('current_reading')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.current_reading ?? null;
}

export async function getLastBillPricePerUnit(): Promise<number | null> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .select('price_per_unit')
    .gt('price_per_unit', 0)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.price_per_unit ?? null;
}

export async function getBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addBill(bill: Omit<Bill, 'id'>): Promise<number> {
  const { data, error } = await supabase
    .from('electricity_bills')
    .insert({
      month: bill.month,
      year: bill.year,
      previous_reading: bill.previous_reading,
      current_reading: bill.current_reading,
      units_consumed: bill.units_consumed,
      price_per_unit: bill.price_per_unit,
      total_amount: bill.total_amount,
      status: bill.status,
      paid_date: bill.paid_date ?? null,
      image_uri: bill.image_uri ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateBillImage(id: number, imageUri: string | null): Promise<void> {
  const { error } = await supabase
    .from('electricity_bills')
    .update({ image_uri: imageUri })
    .eq('id', id);
  if (error) throw error;
}

export async function updateBillStatus(id: number, status: 'paid' | 'unpaid'): Promise<void> {
  const { error } = await supabase
    .from('electricity_bills')
    .update({ status, paid_date: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function updateBill(
  id: number,
  data: {
    month: number; year: number;
    previous_reading: number; current_reading: number;
    units_consumed: number; price_per_unit: number; total_amount: number;
  }
): Promise<void> {
  const { error } = await supabase.from('electricity_bills').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteBill(id: number): Promise<void> {
  const { error } = await supabase.from('electricity_bills').delete().eq('id', id);
  if (error) throw error;
}

// Rent
export async function getRentPayments(): Promise<Rent[]> {
  const { data, error } = await supabase
    .from('rent_payments')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLastRentAmount(): Promise<number | null> {
  const { data, error } = await supabase
    .from('rent_payments')
    .select('amount')
    .gt('amount', 0)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.amount ?? null;
}

export async function addRentPayment(rent: Omit<Rent, 'id'>): Promise<number> {
  const { data, error } = await supabase
    .from('rent_payments')
    .insert({
      month: rent.month,
      year: rent.year,
      amount: rent.amount,
      status: rent.status,
      paid_date: rent.paid_date ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRentStatus(id: number, status: 'paid' | 'unpaid'): Promise<void> {
  const { error } = await supabase
    .from('rent_payments')
    .update({ status, paid_date: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function updateRentPayment(
  id: number,
  data: { month: number; year: number; amount: number }
): Promise<void> {
  const { error } = await supabase.from('rent_payments').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteRentPayment(id: number): Promise<void> {
  const { error } = await supabase.from('rent_payments').delete().eq('id', id);
  if (error) throw error;
}

// Split Records
export async function addSplitRecord(
  record: Omit<SplitRecord, 'id' | 'created_at'>
): Promise<number> {
  const { data, error } = await supabase
    .from('split_records')
    .insert(record)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getSplitRecords(): Promise<SplitRecord[]> {
  const { data, error } = await supabase
    .from('split_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteSplitRecord(id: number): Promise<void> {
  const { error } = await supabase.from('split_records').delete().eq('id', id);
  if (error) throw error;
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('apartment_name, onboarding_done')
    .eq('id', SETTINGS_ID)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_SETTINGS;
}

export async function updateApartmentName(name: string): Promise<void> {
  // Upsert so a fresh project without the seeded row still works.
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, apartment_name: name });
  if (error) throw error;
}

export async function markOnboardingDone(): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, onboarding_done: 1 });
  if (error) throw error;
  initialOnboardingDone = true;
}

export function setOnboardingDone(): void {
  initialOnboardingDone = true;
}
