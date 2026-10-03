const PgBoss = require('pg-boss');
require('dotenv').config();

// Obtiene la URL de conexión a Supabase configurada en tu .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ Error: DATABASE_URL no encontrada en el archivo .env');
    process.exit(1);
}

// Inicializa pg-boss apuntando al esquema dedicado 'pgboss'
const boss = (PgBoss.PgBoss) ? new PgBoss.PgBoss(connectionString) : new PgBoss(connectionString);

async function run() {
    console.log('🔄 Conectando a Supabase e instanciando esquema de colas...');

    // 1. boss.start() ejecuta internamente los scripts DDL en PostgreSQL
    await boss.start();
    console.log('✅ Esquema y tablas maestras de pg-boss creadas exitosamente.');

    const MAIN_QUEUE = 'sunat-invoice-queue';
    const DLQ_QUEUE = 'sunat-invoice-dlq';

    // 2. Crear la Dead Letter Queue (DLQ)
    await boss.createQueue(DLQ_QUEUE);
    console.log(`✅ Cola DLQ registrada: "${DLQ_QUEUE}"`);

    // 3. Crear la Cola Principal vinculada a la DLQ con política de reintentos
    await boss.createQueue(MAIN_QUEUE, {
        retryLimit: 3,         // Reintentos máximos antes de mover a DLQ
        retryDelay: 5,         // Espera de 5 segundos
        retryBackoff: true,    // Incremento exponencial
        deadLetter: DLQ_QUEUE  // Enlace a la DLQ
    });
    console.log(`✅ Cola Principal registrada: "${MAIN_QUEUE}" (enrutada a DLQ ante fallos)`);

    await boss.stop();
    console.log('🚀 Modelado de colas finalizado con éxito.');
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Error durante la inicialización:', err);
    process.exit(1);
});