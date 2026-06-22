// One-off migration: read the iPhone's local SQLite DB and load it into Supabase.
//
// Usage (from project root):
//   set SUPABASE_DB_URL=postgresql://...   (PowerShell: $env:SUPABASE_DB_URL="...")
//   node --experimental-sqlite migration/import-from-sqlite.mjs [path-to.db] [--replace]
//
// - Default db path: migration/home-manager.db
// - Reads bills, rent, split records and settings (lossless).
// - The real SQLite engine opens the file, so WAL side-files (-wal/-shm) are
//   applied automatically as long as they sit next to the .db file.
// - --replace : TRUNCATE the Supabase data tables first (clean one-shot migration).
//   Without it, rows are appended (re-running would duplicate).
// - Safe to re-run with --replace; it always reproduces the same result.

import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const argv = process.argv.slice(2);
const replace = argv.includes('--replace');
const dbArg = argv.find((a) => !a.startsWith('--'));
const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = dbArg ? path.resolve(dbArg) : path.join(here, 'home-manager.db');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('ERROR: set SUPABASE_DB_URL env var (Supabase Postgres connection string).');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: SQLite file not found at: ${dbPath}`);
  console.error('Drop home-manager.db (and its -wal/-shm files) into migration/ first.');
  process.exit(1);
}

// ---- Read SQLite ----------------------------------------------------------
const sqlite = new DatabaseSync(dbPath); // read-write so WAL is checkpointed on open

function readTable(name) {
  try {
    return sqlite.prepare(`SELECT * FROM ${name}`).all();
  } catch (err) {
    console.warn(`  (table ${name} not readable: ${err.message})`);
    return [];
  }
}

const bills = readTable('electricity_bills');
const rents = readTable('rent_payments');
const splits = readTable('split_records');
const settingsRows = readTable('app_settings');
sqlite.close();

console.log('Read from SQLite:');
console.log(`  electricity_bills: ${bills.length}`);
console.log(`  rent_payments:     ${rents.length}`);
console.log(`  split_records:     ${splits.length}`);
console.log(`  app_settings:      ${settingsRows.length}`);

const num = (v, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));
const str = (v) => (v === undefined ? null : v);

// ---- Write to Supabase ----------------------------------------------------
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function insertRows(table, columns, rows, mapRow) {
  if (rows.length === 0) return 0;
  let count = 0;
  for (const row of rows) {
    const values = mapRow(row);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
    count++;
  }
  return count;
}

try {
  await client.connect();
  await client.query('BEGIN');

  if (replace) {
    console.log('\n--replace: truncating Supabase data tables first...');
    await client.query('TRUNCATE public.electricity_bills, public.rent_payments, public.split_records RESTART IDENTITY');
  }

  const billCols = ['month', 'year', 'previous_reading', 'current_reading', 'units_consumed',
    'price_per_unit', 'total_amount', 'status', 'paid_date', 'image_uri', 'created_at'];
  const nBills = await insertRows('electricity_bills', billCols, bills, (b) => [
    num(b.month), num(b.year), num(b.previous_reading), num(b.current_reading),
    num(b.units_consumed), num(b.price_per_unit), num(b.total_amount),
    b.status === 'paid' ? 'paid' : 'unpaid', str(b.paid_date), str(b.image_uri),
    b.created_at ? new Date(b.created_at) : new Date(),
  ]);

  const rentCols = ['month', 'year', 'amount', 'status', 'paid_date', 'created_at'];
  const nRents = await insertRows('rent_payments', rentCols, rents, (r) => [
    num(r.month), num(r.year), num(r.amount),
    r.status === 'paid' ? 'paid' : 'unpaid', str(r.paid_date),
    r.created_at ? new Date(r.created_at) : new Date(),
  ]);

  const splitCols = ['period', 'total_amount', 'total_units', 'per_unit', 'our_units', 'our_amount',
    'top_floor_units', 'top_floor_amount', 'underground_units', 'underground_amount', 'created_at'];
  const nSplits = await insertRows('split_records', splitCols, splits, (s) => [
    str(s.period), num(s.total_amount), num(s.total_units), num(s.per_unit),
    num(s.our_units), num(s.our_amount), num(s.top_floor_units), num(s.top_floor_amount),
    num(s.underground_units), num(s.underground_amount),
    s.created_at ? new Date(s.created_at) : new Date(),
  ]);

  // Settings: upsert the single row (id = 1).
  const s = settingsRows[0];
  if (s) {
    await client.query(
      `INSERT INTO public.app_settings (id, apartment_name, onboarding_done)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET apartment_name = EXCLUDED.apartment_name,
                                      onboarding_done = EXCLUDED.onboarding_done`,
      [s.apartment_name ?? 'My Apartment', num(s.onboarding_done, 1)]
    );
  }

  await client.query('COMMIT');

  console.log('\nInserted into Supabase:');
  console.log(`  electricity_bills: ${nBills}`);
  console.log(`  rent_payments:     ${nRents}`);
  console.log(`  split_records:     ${nSplits}`);
  console.log(`  app_settings:      ${s ? 1 : 0}`);
  console.log('\n✅ Migration complete.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('\n❌ FAILED (rolled back):', err.message);
  process.exit(2);
} finally {
  await client.end();
}
