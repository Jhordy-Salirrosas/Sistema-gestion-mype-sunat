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

# Instalación base
npm install

# Instalar dependencias criptográficas requeridas para la firma XML (SUNAT)
npm install node-forge xml-crypto @xmldom/xmldom
npm install -D @types/node-forge @types/xml-crypto
```

### 2. Configuración de Variables de Entorno
Debes crear tu archivo de variables de entorno local basándote en el archivo de ejemplo.

```bash
cp .env.example .env
```
Edita el archivo `.env` y configura las siguientes variables (principalmente tu conexión a Supabase):
```env
DATABASE_URL="postgres://postgres.[tus-credenciales]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.[tus-credenciales]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
PORT=3000
NODE_ENV=development
```

### 3. Verificar la conexión a la Base de Datos
Para comprobar que Prisma se conecta correctamente a Supabase usando tus credenciales, ejecuta:
```bash
npx prisma db pull
```
*(Nota: Si la base de datos recién ha sido creada y está vacía, este comando arrojará el código `P4001`. Esto es completamente normal y confirma que la conexión fue exitosa).*

### 4. Migraciones de la Base de Datos (Prisma)
Una vez configurada la URL de la base de datos, debes crear las tablas en Supabase y generar los tipos locales ejecutando:
```bash
npx prisma migrate dev --name init
```

### 5. Iniciar el Servidor de Desarrollo
```bash
npm run start:dev
```
El servidor se levantará en `http://localhost:3000`.

### 6. Comandos Especiales de Desarrollo y Seguridad
El proyecto incluye scripts creados para facilitar el desarrollo y asegurar el repositorio:

*   **Generar Certificado Mock (Para entorno local):**
    El módulo de SUNAT exige variables criptográficas válidas para arrancar. Si aún no tienes un certificado real, genera uno falso (matemáticamente válido) ejecutando:
    ```bash
    node scripts/generate-dev-cert.js
    ```
    *(Copia el resultado y pégalo en tu archivo `.env` local).*

*   **Cazador de Secretos (CI/CD):**
    Para verificar manualmente que no estás a punto de subir archivos `.env` o certificados `.pfx` a tu repositorio, ejecuta:
    ```bash
    npm run check:secrets
    ```

---

## 🌿 Flujo de Trabajo y Ramas (Git Flow)

Este proyecto utiliza un flujo de trabajo simplificado basado en **Git Flow** y **Pull Requests (PR)** para mantener la estabilidad del código y asegurar la calidad.

### Estructura de Ramas Principales:
- `main`: Rama de **Producción**. Siempre contiene código estable, testeado y listo para despliegue. Bajo ninguna circunstancia se hacen commits directos aquí.
- `dev`: Rama de **Integración/Desarrollo**. Todo el nuevo código del equipo se integra aquí para pruebas conjuntas antes del pase a producción.

### Creación de Ramas de Trabajo:
Para cualquier nueva tarea del Sprint, el desarrollador debe crear una rama temporal partiendo desde `dev`. Utilizamos la convención descriptiva de prefijos:

```bash
# Convención: tipo/ID-ticket-descripcion-corta
# Tipos comunes: feature/, bugfix/, chore/
git checkout -b feature/TT-01-modelado-sql-comprobantes
```

### Ciclo de Vida del Desarrollo:
1. Crear la rama `feature/*` localmente a partir de `dev`.
2. Desarrollar la funcionalidad y subir los commits.
3. Abrir un **Pull Request (PR)** dirigido hacia la rama `dev`.
4. El pipeline de CI (GitHub Actions) ejecutará automáticamente el linter y los tests. No se permite el merge si estas validaciones fallan.
5. Tras la revisión (Code Review) y aprobación del equipo, se realiza el merge a `dev`.
6. Al finalizar y certificar un Sprint, se realiza un PR definitivo de `dev` hacia `main` para el pase a Producción.

---
*Este proyecto es desarrollado bajo un esquema de Sprints iterativos con integración continua automatizada (CI/CD).*
