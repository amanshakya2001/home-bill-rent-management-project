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
  due_date: string;
  status: 'paid' | 'unpaid';
  paid_date: string | null;
  notification_id: string | null;
  image_uri: string | null;
};

export type Rent = {
  id: number;
  month: number;
  year: number;
  amount: number;
  due_date: string;
  status: 'paid' | 'unpaid';
  paid_date: string | null;
  notification_id: string | null;
};

export type AppSettings = {
  apartment_name: string;
  bill_due_day: number;
  rent_due_day: number;
  notifications_enabled: number;
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
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_date TEXT,
      notification_id TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_date TEXT,
      notification_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      apartment_name TEXT NOT NULL DEFAULT 'My Apartment',
      bill_due_day INTEGER NOT NULL DEFAULT 10,
      rent_due_day INTEGER NOT NULL DEFAULT 1,
      notifications_enabled INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO app_settings (id, apartment_name, bill_due_day, rent_due_day, notifications_enabled)
    VALUES (1, 'My Apartment', 10, 1, 1);
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
  bill: Omit<Bill, 'id' | 'notification_id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO electricity_bills
      (month, year, previous_reading, current_reading, units_consumed, price_per_unit, total_amount, due_date, status, paid_date, image_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bill.month, bill.year, bill.previous_reading, bill.current_reading,
    bill.units_consumed, bill.price_per_unit, bill.total_amount,
    bill.due_date, bill.status, bill.paid_date ?? null, bill.image_uri ?? null
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

export async function saveBillNotificationId(
  db: SQLite.SQLiteDatabase,
  id: number,
  notificationId: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE electricity_bills SET notification_id = ? WHERE id = ?',
    notificationId,
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
    due_date: string;
  }
): Promise<void> {
  await db.runAsync(
    `UPDATE electricity_bills SET
      month = ?, year = ?, previous_reading = ?, current_reading = ?,
      units_consumed = ?, price_per_unit = ?, total_amount = ?, due_date = ?
     WHERE id = ?`,
    data.month, data.year, data.previous_reading, data.current_reading,
    data.units_consumed, data.price_per_unit, data.total_amount, data.due_date, id
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
  rent: Omit<Rent, 'id' | 'notification_id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO rent_payments (month, year, amount, due_date, status, paid_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    rent.month, rent.year, rent.amount, rent.due_date, rent.status, rent.paid_date ?? null
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

export async function saveRentNotificationId(
  db: SQLite.SQLiteDatabase,
  id: number,
  notificationId: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE rent_payments SET notification_id = ? WHERE id = ?',
    notificationId,
    id
  );
}

export async function updateRentPayment(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: { month: number; year: number; amount: number; due_date: string }
): Promise<void> {
  await db.runAsync(
    'UPDATE rent_payments SET month = ?, year = ?, amount = ?, due_date = ? WHERE id = ?',
    data.month, data.year, data.amount, data.due_date, id
  );
}

export async function deleteRentPayment(db: SQLite.SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM rent_payments WHERE id = ?', id);
}

// Settings
export async function getSettings(db: SQLite.SQLiteDatabase): Promise<AppSettings> {
  const settings = await db.getFirstAsync<AppSettings>(
    'SELECT apartment_name, bill_due_day, rent_due_day, notifications_enabled FROM app_settings WHERE id = 1'
  );
  return settings ?? { apartment_name: 'My Apartment', bill_due_day: 10, rent_due_day: 1, notifications_enabled: 1 };
}

export async function updateSettings(
  db: SQLite.SQLiteDatabase,
  settings: AppSettings
): Promise<void> {
  await db.runAsync(
    `UPDATE app_settings SET apartment_name = ?, bill_due_day = ?, rent_due_day = ?, notifications_enabled = ?
     WHERE id = 1`,
    settings.apartment_name, settings.bill_due_day, settings.rent_due_day, settings.notifications_enabled
  );
}
