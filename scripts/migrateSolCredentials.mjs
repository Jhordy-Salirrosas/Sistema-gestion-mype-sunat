import { createCipheriv, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

const keyText = process.env.SOL_CREDENTIALS_ENCRYPTION_KEY ?? '';
const key = Buffer.from(keyText, 'base64');
const apply = process.argv.includes('--apply');

if (key.length !== 32 || key.toString('base64') !== keyText) {
  console.error(
    'Define SOL_CREDENTIALS_ENCRYPTION_KEY como Base64 de 32 bytes.',
  );
  process.exit(1);
}

if (apply && process.env.SOL_CREDENTIALS_MIGRATION_CONFIRM !== 'YES') {
  console.error(
    'Para aplicar cambios, define SOL_CREDENTIALS_MIGRATION_CONFIRM=YES.',
  );
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Define DIRECT_URL o DATABASE_URL para conectar a PostgreSQL.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [
    'sol:v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

async function main() {
  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const result = await client.query(
      'SELECT id, sol_pass_encrypted FROM companies FOR UPDATE',
    );
    const legacyRows = result.rows.filter(
      (row) => !row.sol_pass_encrypted.startsWith('sol:v1:'),
    );

    if (apply) {
      for (const row of legacyRows) {
        const updated = await client.query(
          `UPDATE companies
           SET sol_pass_encrypted = $1, updated_at = NOW()
           WHERE id = $2 AND sol_pass_encrypted = $3`,
          [encrypt(row.sol_pass_encrypted), row.id, row.sol_pass_encrypted],
        );
        if (updated.rowCount !== 1) {
          throw new Error('Concurrent credential update detected.');
        }
      }
      await client.query('COMMIT');
      transactionOpen = false;
    } else {
      await client.query('ROLLBACK');
      transactionOpen = false;
    }

    console.log(
      `${apply ? 'Encrypted' : 'Would encrypt'} ${legacyRows.length} SOL credential record(s).`,
    );
  } catch {
    if (transactionOpen && client) await client.query('ROLLBACK');
    console.error(
      'Credential migration failed; no credential values were displayed.',
    );
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

await main();
