# Especificación Técnica de Módulo: 00_AUTH (Autenticación y Multi-Tenancy)
## Guía Operativa para Desarrolladores y Agentes de IA

**Módulo:** `src/modules/auth/`  
**Responsable Técnico:** Carlos Ahumada Soles (Arquitecto de Software)  
**Nivel de Aislamiento:** Transversal (Gobierna sesión y contexto multi-tenant de toda la SPA)  
**Estatus:** 🔒 VINCULANTE (Spec-Driven Development)

---

## 1. Alcance y Propósito del Módulo
El módulo `auth` gestiona:
1. Inicio de sesión con credenciales corporativas (JWT).
2. Manejo de multi-tenancy: Selección y cambio dinámico de la MYPE activa (`ActiveCompany`).
3. Inyección automática del token y `X-Tenant-Id` en las peticiones mediante `src/lib/axios.ts`.
4. Control de acceso basado en roles RBAC (`ADMIN`, `ACCOUNTANT`, `OPERATOR`).

---

## 2. Mapa de Carpetas y Responsabilidades

```text
src/modules/auth/
├── components/       # Formularios y selectores (LoginForm.tsx, CompanySelector.tsx)
├── hooks/            # Mutaciones de login y selección (useLogin.ts)
├── pages/            # Vistas (LoginPage.tsx)
├── services/         # authApi.ts (endpoints /auth/login, /auth/companies)
├── types/            # auth.types.ts (LoginCredentials, UserProfile, CompanyTenant, AuthResponse)
└── validators/       # authSchema.ts (esquemas Zod para credenciales)
```

---

## 3. Normativa de Desarrollo (Qué SÍ y qué NO se puede hacer)

### ✅ Lo que SÍ se debe hacer:
* Toda validación de credenciales se realiza con el esquema Zod `loginSchema`.
* El hook `useLogin` debe actualizar automáticamente el `useAuthStore` persistente (`sync-sunat-auth`).
* Si el usuario pertenece a más de una empresa, se debe ofrecer un selector de empresa activa antes de entrar a los módulos contables.
* El componente `LoginPage.tsx` debe ser accesible por teclado (`Tab` entre inputs, `Enter` para enviar).

### 🚫 Lo que está TERMINANTEMENTE PROHIBIDO:
* **PROHIBIDO** almacenar contraseñas en texto plano dentro de Zustand o LocalStorage.
* **PROHIBIDO** hacer peticiones de login directamente desde `LoginForm.tsx` sin pasar por el hook `useLogin`.
* **PROHIBIDO** crear archivos de más de 120 líneas.
* **PROHIBIDO** alterar la clave de LocalStorage `'sync-sunat-auth'` de forma manual sin usar las acciones de `authStore`.

---

## 4. Flujo de Trabajo en 6 Pasos para Nuevas Features en `auth`
1. **Contrato:** Declarar tipos en `types/auth.types.ts`.
2. **Schema:** Crear validador en `validators/authSchema.ts`.
3. **Servicio:** Implementar llamada HTTP en `services/authApi.ts`.
4. **Hook:** Construir hook con `useMutation` en `hooks/`.
5. **UI Atómica & Página:** Crear componentes en `components/` y ensamblar en `pages/`.
6. **Ruta:** Registrar la ruta pública en `routes/appRoutes.tsx`.

---

## 5. Instrucciones Específicas para Agentes de IA
* Si se requiere mockear el login para pruebas locales, hágalo exclusivamente a través del hook `useLogin.ts` mediante un bloque de contingencia de desarrollo, sin alterar la firma del servicio `authApi.ts`.
* Verifique siempre que el token JWT se inyecte en el header `Authorization: Bearer <token>`.
* Toda prueba unitaria debe crearse en `test/unit/modules/auth/`, nunca dentro de `src/`.

---

## 6. Estrategia de Pruebas Unitarias (`test/unit/modules/auth/`)

* **Ubicación Exclusiva:** `test/unit/modules/auth/`
* **Casos Críticos a Probar:**
  1. **`loginSchema.test.ts`:** Validación de correo electrónico bien formado, rechazo de contraseñas cortas (< 8 caracteres), y obligatoriedad de campos.
  2. **`authStore.test.ts`:** Persistencia correcta de JWT y empresa activa en LocalStorage, y borrado total de credenciales tras cerrar sesión.

