import { execSync } from 'node:child_process';

const isRender =
  process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);

if (!isRender) {
  console.log('[render-migrate] Omitido: no se ejecuta fuera de Render.');
  process.exit(0);
}

console.log('[render-migrate] Aplicando migraciones Prisma en Render...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });
