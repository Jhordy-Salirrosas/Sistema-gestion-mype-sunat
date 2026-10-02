# SYNC-SUNAT: Sistema de Gestión Contable-Tributaria e Importaciones

**SYNC-SUNAT** es un sistema resiliente diseñado para MYPES, enfocado en mantener la continuidad operativa ante las caídas, latencias o saturaciones de los servicios web de la SUNAT. 

## 🚀 Arquitectura y Tecnologías
El sistema se basa en una arquitectura **Cliente-Servidor asíncrona** y altamente resiliente utilizando el patrón **Transactional Outbox**.

- **Backend:** NestJS (Node.js + TypeScript)
- **Base de Datos:** PostgreSQL alojado en Supabase
- **ORM:** Prisma
- **Motor de Colas Asíncronas:** `pg-boss` (garantiza atomicidad entre la BD relacional y la cola de tareas).
- **Patrones de Resiliencia:** 
  - **Buffer Asíncrono:** Las ventas no se detienen si la SUNAT está caída.
  - **Backoff Exponencial:** Reintentos progresivos ante fallos de red.
  - **Circuit Breaker:** Apertura de circuito ante múltiples errores 503 consecutivos para no saturar los endpoints.
  - **Dead Letter Queue (DLQ):** Almacenamiento seguro de transacciones permanentemente fallidas para revisión manual.

## 📦 Módulos Principales
1. **Dashboard de Resiliencia:** Monitoreo en tiempo real de métricas críticas como MTTD y MTTR, estado de colas y conexión a SUNAT.
2. **Facturación Electrónica:** Emisión de comprobantes XML UBL 2.1.
3. **Módulo de Importaciones (DUA/DAM):** Ingesta de despachos aduaneros y cálculo automático de prorrateo (FOB, Flete, Seguro, Ad-Valorem) al Kardex.
4. **Módulo Contable (SIRE / PLE):** Carga de Excel/CSV del SIRE para el cruce multidimensional automático y detección de discrepancias, además de la exportación de libros TXT oficiales.

---

## 🛠️ Guía de Instalación y Configuración Inicial

### 1. Clonar el repositorio y dependencias
```bash
git clone <url-del-repositorio>
cd Sistema-gestion-mype-sunat
npm install
```

### 2. Configuración de Variables de Entorno
Debes crear tus archivos de variables de entorno locales basándote en el archivo de ejemplo.

```bash
cp .env.example .env.development
```
Edita `.env.development` y configura las siguientes variables (principalmente tu conexión a Supabase):
```env
DATABASE_URL="postgres://postgres.[tus-credenciales]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.[tus-credenciales]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
PORT=3000
NODE_ENV=development
```

### 3. Migraciones de la Base de Datos (Prisma)
Una vez configurada la URL de la base de datos, debes crear las tablas en Supabase y generar los tipos locales ejecutando:
```bash
npx prisma migrate dev --name init
```

### 4. Iniciar el Servidor de Desarrollo
```bash
npm run start:dev
```
El servidor se levantará en `http://localhost:3000`.

---
*Este proyecto es desarrollado bajo un esquema de Sprints iterativos con integración continua automatizada (CI/CD).*
