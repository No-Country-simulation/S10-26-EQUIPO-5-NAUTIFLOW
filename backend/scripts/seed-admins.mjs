import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const seedFile = resolve(process.argv[2] ?? 'admin-seed.json');
const seedUsers = JSON.parse(await readFile(seedFile, 'utf8'));
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'La creación de administradores está deshabilitada en producción.',
  );
}
if (process.env.ALLOW_ADMIN_SEED !== 'true') {
  throw new Error(
    'Para confirmar la creación de administradores, define ALLOW_ADMIN_SEED=true.',
  );
}
const requiredDatabaseSettings = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
];
const missingDatabaseSettings = requiredDatabaseSettings.filter(
  (setting) => !process.env[setting],
);

if (missingDatabaseSettings.length) {
  throw new Error(
    `Faltan variables de base de datos: ${missingDatabaseSettings.join(', ')}`,
  );
}
if (!Number.isInteger(Number(process.env.DB_PORT))) {
  throw new Error('DB_PORT debe ser un número entero.');
}

if (!Array.isArray(seedUsers) || seedUsers.length !== 3) {
  throw new Error('El archivo debe contener exactamente tres administradores.');
}

const emails = new Set();
for (const [index, user] of seedUsers.entries()) {
  if (
    typeof user.name !== 'string' ||
    user.name.trim().length < 2 ||
    user.name.length > 120 ||
    typeof user.email !== 'string' ||
    user.email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
    typeof user.phone !== 'string' ||
    user.phone.trim().length < 1 ||
    user.phone.length > 30 ||
    typeof user.password !== 'string' ||
    user.password.length < 12 ||
    user.password.length > 128
  ) {
    throw new Error(
      `El administrador número ${index + 1} tiene datos inválidos.`,
    );
  }

  const email = user.email.trim().toLowerCase();
  if (emails.has(email)) {
    throw new Error('Los tres correos deben ser distintos.');
  }
  emails.add(email);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const client = await pool.connect();

try {
  await client.query('BEGIN');
  for (const user of seedUsers) {
    const email = user.email.trim().toLowerCase();
    const existing = await client.query(
      'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    if (existing.rowCount) {
      throw new Error(`Ya existe una cuenta con el correo ${email}.`);
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${scryptSync(user.password, salt, 64).toString('hex')}`;
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [user.name.trim(), email, passwordHash, user.phone.trim()],
    );
  }
  await client.query('COMMIT');
  console.log('Se crearon las tres cuentas administrativas indicadas.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
