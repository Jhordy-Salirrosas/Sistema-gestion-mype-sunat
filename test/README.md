# Arquitectura de Pruebas Multi-Capa: SYNC-SUNAT

**Proyecto:** SYNC-SUNAT  
**Autor:** Carlos Ahumada Soles (Arquitecto de Software)  

---

## 📁 Estructura de la Suite de Pruebas

Todas las pruebas del proyecto residen **estrictamente dentro de la carpeta `test/`** siguiendo el patrón espejo (*Mirror Directory Pattern*) con respecto a `src/`:

```text
test/
├── unit/                       # Pruebas Unitarias de lógica pura y adaptadores (sin BD)
│   ├── accounting/             # [M5] Partida doble, validación y exportación PLE TXT (Michael Velásquez)
│   ├── auth/                   # [TRANSVERSAL] Value objects, reglas, casos de uso y guards de autenticación
│   ├── common/                 # [TRANSVERSAL] Componentes transversales (healthController, pipes, filters)
│   ├── config/                 # [TRANSVERSAL] Validación de variables de entorno Fail-Fast
│   ├── customs/                # [M3] Reglas CIF, liquidación de impuestos y cálculo DUA
│   ├── database/               # [TRANSVERSAL] Instanciación y adaptadores Prisma
│   ├── invoices/               # [M1] Casos de uso, repositorios Prisma, reglas IGV, VO series y validadores (Jhordy Salirrosas)
│   ├── resilience/             # [M2] Mocks, breakers y controladores de resiliencia (Oliver Saldaña)
│   ├── sire/                   # [M4] Motor de cruce y conciliación SIRE
│   └── sunat/                  # Parseo de CDRs, firmas XML, certificados y cliente SOAP
├── integration/                # Pruebas de Integración (módulos cruzados y mock SOAP)
│   ├── invoices/               # Transactional Outbox contra PostgreSQL real
│   ├── resilience/             # TA-34: 503, timeout, caída/retorno, MTTD y MTTR
│   └── sunat/                  # Integración con el mock SOAP de SUNAT
├── e2e/                        # Pruebas End-to-End de flujos verticales completos (UI/API -> BD)
│   └── invoices/               # Emisión de facturas completa
├── chaos/                      # Pruebas de Resiliencia y Caos (Medición de MTTD <= 5s y MTTR <= 60s)
├── mocks/                      # Controladores y generadores simulados para pruebas
│   └── sunat/                  # Mock del billService de SUNAT y fixtures de CDR
├── fixtures/                   # Muestras oficiales (XML UBL, Certificados, CDRs, DUA, TXT SIRE/PLE)
│   └── sunat-fixtures.spec.ts  # Pruebas de integridad de fixtures y certificados
├── jest-e2e.json               # Configuración de Jest para pruebas E2E y de integración
└── setup.ts                    # Bootstrap de variables de entorno y certificados para tests
```

---

## 🚀 Guía de Comandos para el Equipo

> 💡 **Nota importante:** Usa siempre `npm test -- <ruta>` en lugar de `npx jest` directo para asegurar la resolución de módulos nativos ESM (`--experimental-vm-modules`).

### 1. Ejecución General

| Acción | Comando |
| :--- | :--- |
| **Ejecutar TODAS las pruebas** del proyecto | `npm test` |
| **Modo Observación (Watch Mode)** (re-ejecuta al guardar cambios) | `npm test -- --watch` |
| **Generar reporte de cobertura (Coverage)** | `npm run test:cov` |

---

### 2. Ejecutar Pruebas por Módulo Específico

Cada integrante del equipo debe ejecutar las pruebas de su módulo asignado con los siguientes comandos:

| Módulo / Área | Integrante Asignado | Comando |
| :--- | :--- | :--- |
| **Facturación Electrónica (`invoices`)** | Jhordy Salirrosas | `npm test -- test/unit/invoices` |
| **Resiliencia y Caos (`resilience`)** | Oliver Saldaña | `npm test -- test/unit/resilience` |
| **Despacho Aduanero (`customs`)** | Carlos Ahumada | `npm test -- test/unit/customs` |
| **Conciliación SIRE (`sire`)** | Equipo SIRE | `npm test -- test/unit/sire` |
| **Contabilidad y PLE (`accounting`)** | Michael Velásquez | `npm test -- test/unit/accounting` |
| **Seguridad y Autenticación (`auth`)** | Transversal | `npm test -- test/unit/auth` |
| **Servicios SUNAT (Firma/SOAP/CDR)** | Transversal | `npm test -- test/unit/sunat` |
| **Configuración Fail-Fast (`config`)** | Transversal | `npm test -- test/unit/config` |
| **Salud y Utilitarios (`common`)** | Transversal | `npm test -- test/unit/common` |
| **Persistencia (`database`)** | Transversal | `npm test -- test/unit/database` |

---

### 3. Ejecutar un Archivo o Caso de Prueba Específico

#### Por archivo individual:
```bash
# Ejemplo: Probar solo el servicio de facturación
npm test -- test/unit/invoices/invoices.service.spec.ts

# Ejemplo: Probar solo las reglas contables
npm test -- test/unit/accounting/doubleEntryRule.spec.ts

# Ejemplo: Probar la firma digital de SUNAT
npm test -- test/unit/sunat/signature.service.spec.ts
```

#### Modo Watch en tu módulo mientras desarrollas:
```bash
# Se ejecuta automáticamente cada vez que guardas un archivo de tu módulo
npm test -- test/unit/invoices --watch
npm test -- test/unit/accounting --watch
```

#### Filtrar por nombre de un test individual (`-t`):
```bash
# Ejecuta únicamente los tests cuyo nombre contenga "Módulo 11"
npm test -- -t "Módulo 11"

# Ejecuta únicamente los tests que contengan "partida doble"
npm test -- -t "partida doble"
```

---

### 4. Otros Tipos de Pruebas

#### Pruebas de Integración:
Valida la comunicación entre componentes internos y el mock SOAP de SUNAT:
```bash
npm test -- test/integration
```

#### Pruebas de Fixtures y Certificados:
Valida que los XMLs de muestra y los certificados digitales X.509 funcionen:
```bash
npm test -- test/fixtures
```

#### Pruebas End-to-End (E2E):
Valida flujos completos de API HTTP hacia base de datos:
```bash
npm run test:e2e
```

#### Pruebas de Resiliencia y Caos:
Evalúa la inyección de fallos, tolerancia a caídas 503 y métricas MTTD / MTTR:
```bash
npm test -- test/chaos
```

---

## 📌 Reglas Obligatorias para Desarrollar Tests

1. **CERO `.spec.ts` dentro de `src/`:**  
   Todos los archivos de prueba deben crearse dentro de `test/unit/<tu-modulo>/`. Ninguna prueba debe vivir en `src/`.
2. **Nomenclatura:**  
   El archivo de prueba debe llamarse `<nombre-del-archivo>.spec.ts`.  
   *Ejemplo:* Para `src/modules/accounting/domain/rules/doubleEntryRule.ts`, su test es `test/unit/accounting/doubleEntryRule.spec.ts`.
3. **Ruta de importación hacia el código de producción:**  
   Desde `test/unit/<modulo>/`, debes subir 3 niveles para llegar a `src/`:
   ```typescript
   import { DoubleEntryRule } from '../../../src/modules/accounting/domain/rules/doubleEntryRule';
   import { InvoiceStatus } from '../../../src/generated/client/enums';
   ```
4. **Pruebas Unitarias Aisladas:**  
   Las pruebas en `test/unit/` **no deben conectar a la base de datos real** ni a servicios externos. Usa mocks o stubs (como los disponibles en `test/mocks/`).
