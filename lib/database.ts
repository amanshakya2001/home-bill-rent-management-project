import * as SQLite from 'expo-sqlite';

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
  notifications_enabled: number;
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

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS electricity_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      previous_reading REAL NOT NULL DEFAULT 0,
      current_reading REAL NOT NULL DEFAULT 0,
      units_consumed REAL NOT NULL,
      price_per_unit REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_date TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS split_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL,
      total_amount REAL NOT NULL,
      total_units REAL NOT NULL,
      per_unit REAL NOT NULL,
      our_units REAL NOT NULL,
      our_amount REAL NOT NULL,
      top_floor_units REAL NOT NULL,
      top_floor_amount REAL NOT NULL,
      underground_units REAL NOT NULL,
      underground_amount REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      apartment_name TEXT NOT NULL DEFAULT 'My Apartment',
      notifications_enabled INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO app_settings (id, apartment_name, notifications_enabled)
    VALUES (1, 'My Apartment', 1);
  `);

  // Migrations for existing databases
  const migrations = [
    `ALTER TABLE electricity_bills ADD COLUMN image_uri TEXT;`,
    `ALTER TABLE electricity_bills ADD COLUMN previous_reading REAL NOT NULL DEFAULT 0;`,
    `ALTER TABLE electricity_bills ADD COLUMN current_reading REAL NOT NULL DEFAULT 0;`,
  ];
  for (const sql of migrations) {
    try { await db.execAsync(sql); } catch { /* column already exists */ }
  }
}

// Bills
export async function getLastBillReading(db: SQLite.SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ current_reading: number }>(
    'SELECT current_reading FROM electricity_bills ORDER BY year DESC, month DESC LIMIT 1'
  );
  return row?.current_reading ?? null;
}

export function getBills(db: SQLite.SQLiteDatabase): Promise<Bill[]> {
  return db.getAllAsync<Bill>(
    'SELECT * FROM electricity_bills ORDER BY year DESC, month DESC'
  );
}

export async function addBill(
  db: SQLite.SQLiteDatabase,
  bill: Omit<Bill, 'id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO electricity_bills
      (month, year, previous_reading, current_reading, units_consumed, price_per_unit, total_amount, status, paid_date, image_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bill.month, bill.year, bill.previous_reading, bill.current_reading,
    bill.units_consumed, bill.price_per_unit, bill.total_amount,
    bill.status, bill.paid_date ?? null, bill.image_uri ?? null
  );
  return result.lastInsertRowId;
}

export async function updateBillImage(
  db: SQLite.SQLiteDatabase,
  id: number,
  imageUri: string | null
): Promise<void> {
  await db.runAsync('UPDATE electricity_bills SET image_uri = ? WHERE id = ?', imageUri, id);
}

export async function updateBillStatus(
  db: SQLite.SQLiteDatabase,
  id: number,
  status: 'paid' | 'unpaid'
): Promise<void> {
  await db.runAsync(
    'UPDATE electricity_bills SET status = ?, paid_date = ? WHERE id = ?',
    status,
    status === 'paid' ? new Date().toISOString() : null,
    id
  );
}

export async function updateBill(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: {
    month: number; year: number;
    previous_reading: number; current_reading: number;
    units_consumed: number; price_per_unit: number; total_amount: number;
  }
): Promise<void> {
  await db.runAsync(
    `UPDATE electricity_bills SET
      month = ?, year = ?, previous_reading = ?, current_reading = ?,
      units_consumed = ?, price_per_unit = ?, total_amount = ?
     WHERE id = ?`,
    data.month, data.year, data.previous_reading, data.current_reading,
    data.units_consumed, data.price_per_unit, data.total_amount, id
  );
}

export async function deleteBill(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM electricity_bills WHERE id = ?', id);
}

// Rent
export function getRentPayments(db: SQLite.SQLiteDatabase): Promise<Rent[]> {
  return db.getAllAsync<Rent>(
    'SELECT * FROM rent_payments ORDER BY year DESC, month DESC'
  );
}

export async function addRentPayment(
  db: SQLite.SQLiteDatabase,
  rent: Omit<Rent, 'id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO rent_payments (month, year, amount, status, paid_date)
     VALUES (?, ?, ?, ?, ?)`,
    rent.month, rent.year, rent.amount, rent.status, rent.paid_date ?? null
  );
  return result.lastInsertRowId;
}

export async function updateRentStatus(
  db: SQLite.SQLiteDatabase,
  id: number,
  status: 'paid' | 'unpaid'
): Promise<void> {
  await db.runAsync(
    'UPDATE rent_payments SET status = ?, paid_date = ? WHERE id = ?',
    status,
    status === 'paid' ? new Date().toISOString() : null,
    id
  );
}

export async function updateRentPayment(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: { month: number; year: number; amount: number }
): Promise<void> {
  await db.runAsync(
    'UPDATE rent_payments SET month = ?, year = ?, amount = ? WHERE id = ?',
    data.month, data.year, data.amount, id
  );
}

export async function deleteRentPayment(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM rent_payments WHERE id = ?', id);
}

// Split Records
export async function addSplitRecord(
  db: SQLite.SQLiteDatabase,
  record: Omit<SplitRecord, 'id' | 'created_at'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO split_records
      (period, total_amount, total_units, per_unit, our_units, our_amount,
       top_floor_units, top_floor_amount, underground_units, underground_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.period, record.total_amount, record.total_units, record.per_unit,
    record.our_units, record.our_amount, record.top_floor_units, record.top_floor_amount,
    record.underground_units, record.underground_amount
  );
  return result.lastInsertRowId;
}

export function getSplitRecords(db: SQLite.SQLiteDatabase): Promise<SplitRecord[]> {
  return db.getAllAsync<SplitRecord>(
    'SELECT * FROM split_records ORDER BY created_at DESC'
  );
}

export async function deleteSplitRecord(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM split_records WHERE id = ?', id);
}

// Settings
export async function getSettings(db: SQLite.SQLiteDatabase): Promise<AppSettings> {
  const settings = await db.getFirstAsync<AppSettings>(
    'SELECT apartment_name, notifications_enabled FROM app_settings WHERE id = 1'
  );
  return settings ?? { apartment_name: 'My Apartment', notifications_enabled: 1 };
}

export async function updateSettings(
  db: SQLite.SQLiteDatabase,
  settings: AppSettings
): Promise<void> {
  await db.runAsync(
    `UPDATE app_settings SET apartment_name = ?, notifications_enabled = ? WHERE id = 1`,
    settings.apartment_name, settings.notifications_enabled
  );
}
