# Conexión de homologación SUNAT (TA-22)

`SunatBillService` firma y envía el ZIP mediante `sendBill`, decodifica el
`applicationResponse` con `parseCdr()` y persiste el XML/código/descripción del
CDR en `Invoice.cdr_sunat` y `TransactionHistory`.

## Credenciales y certificado

La homologación pública de SUNAT suele usar el RUC `20000000001`, usuario
secundario `MODDATOS` y clave `moddatos`. Confirma que esas credenciales sigan
habilitadas o utiliza el RUC/usuario asignados a la empresa. El usuario SOAP se
construye como `<RUC><SUNAT_SOL_USER>`; la contraseña solo se transmite por TLS.

Configura certificado PKCS#12, clave, credenciales SOL y base de datos solo en
`.env` local o en el gestor de secretos del entorno. No guardes `.pfx`, `.p12`,
claves privadas, contraseñas SOL ni valores Base64 en Git. `fixtures/certs/` se
mantiene ignorado por Git; el certificado de homologación válido debe
corresponder al RUC configurado.

El entorno predeterminado es Beta:

```env
SUNAT_ENV=beta
SUNAT_BILL_SERVICE_URL_BETA=https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
SUNAT_BILL_SERVICE_URL_PRODUCCION=https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService
```

Producción nunca se selecciona por defecto: requiere cambiar explícitamente
`SUNAT_ENV=produccion`. `SUNAT_BILL_SERVICE_URL`, si se configura, tiene
precedencia y se reserva para destinos explícitos como el Mock.

## Evidencia del envío real

Prepara primero una fila `Invoice` de prueba en la base de datos Beta, con
`id`, RUC, tipo `01`, serie y correlativo idénticos a los valores de test. Usa
un correlativo permitido y no utilizado anteriormente. Completa en `.env`:

```env
RUN_SUNAT_BETA_INTEGRATION=true
SUNAT_BETA_RUC=20000000001
SUNAT_BETA_CERT_PASSWORD=<clave-local-del-certificado>
SUNAT_BETA_CERT_BASE64=<PKCS12-en-Base64>
SUNAT_BETA_DATABASE_URL=<URL-de-la-base-de-datos-de-prueba>
SUNAT_BETA_INVOICE_ID=<id-de-la-factura-preparada>
SUNAT_BETA_SERIE=F001
SUNAT_BETA_CORRELATIVO=<correlativo-no-utilizado>
SUNAT_BETA_LEGAL_NAME=<razon-social-registrada-para-el-RUC>
SUNAT_SOL_USER=MODDATOS
SUNAT_SOL_PASSWORD=moddatos
```

Ejecuta únicamente bajo demanda:

```bash
npm run test:sunat:beta
```

La prueba está omitida por defecto. Con el opt-in activado valida que el endpoint
sea exactamente Beta, firma el XML UBL 2.1 de `fixtures/sunat-invoice/`, envía
una sola factura, decodifica y comprueba el código `0`/descripción, y persiste
el CDR con el servicio existente. Requiere acceso de red a SUNAT y a la base de
datos de pruebas. Si una petición termina en timeout, verifica el estado en
SUNAT antes de volver a usar ese correlativo.

La evidencia en consola incluye endpoint, XML UBL firmado, nombre y hash del
ZIP, y CDR decodificado. No registra el sobre SOAP ni la contraseña SOL. El
resultado persistido se puede verificar en `Invoice.cdr_sunat` usando el ID de
factura indicado.
