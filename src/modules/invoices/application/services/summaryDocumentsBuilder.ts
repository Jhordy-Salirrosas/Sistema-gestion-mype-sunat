import { redondearMoneda as r2 } from '../../money';
/**
 * Comunicación de baja (RA) y resumen diario de boletas (RC) — TA-67.
 *
 * Los comprobantes individuales (facturas, notas) se envían uno por uno con
 * `sendBill`. Las BOLETAS y notas que las afectan viajan agrupadas:
 *
 *  - **Resumen diario (RC, tipo 03):** todas las boletas y notas del día, en un
 *    único XML que se envía con `sendSummary` y devuelve un NÚMERO DE TICKET.
 *    El CDR no llega en la misma llamada: hay que preguntar por el ticket con
 *    `getStatus` hasta que SUNAT responda.
 *  - **Comunicación de baja (RA, tipo RA):** los comprobantes que se anulan
 *    después de haber sido aceptados no se borran: se informan. SUNAT no acepta
 *    la anulación de un comprobante que todavía no procesó.
 *
 * Este módulo genera los dos XML y valida sus reglas. El envío SOAP vive aparte:
 * separar la construcción del transporte permite probar el XML sin red, que es
 * donde están casi todos los rechazos evitables.
 *
 * Reglas que se aplican aquí:
 *
 *  - **El resumen solo lleva boletas (03) y notas a boletas (07/08 con serie que
 *    empieza en B).** Incluir una factura en un resumen es un rechazo seguro: las
 *    facturas van por `sendBill`.
 *  - **Un resumen por día.** El `IssueDate` del resumen es el día de los
 *    comprobantes y no admite dos envíos para la misma fecha con el mismo
 *    correlativo.
 *  - **Lo anulado no entra al resumen y lo dado de baja tampoco.** Si un
 *    comprobante ya se informó como baja, volver a incluirlo lo resucita.
 */
import { BadRequestException } from '@nestjs/common';

/** Tipos de comprobante que viajan agregados en un resumen diario. */
export const TIPOS_EN_RESUMEN: readonly string[] = ['03', '07', '08'];

/** Estado que habilita dar de baja un comprobante. */
export const ESTADOS_DADOS_DE_BAJA_VALIDOS: readonly string[] = [
  'ACEPTADO',
  'OBSERVADO',
];

/** Un comprobante dentro del resumen o de la baja. */
export interface ComprobanteAgregado {
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  /** Fecha de emisión YYYY-MM-DD. */
  fechaEmision: string;
  /** Estado actual del comprobante. */
  estado: string;
  /** Importe total del comprobante. */
  total: number;
  /** Documento del adquirente: tipo (Catálogo 06) y número. */
  tipoDocCliente: string;
  numDocCliente: string;
  /** Importe total del IGV. */
  igv: number;
  /** Documento que la nota modifica; obligatorio en 07 y 08. */
  documentoAfectado?: string;
  /** Estado del comprobante ante SUNAT: solo lo aceptado puede darse de baja. */
  motivoBaja?: string;
}

/** Datos del emisor y del envío del resumen. */
export interface CabeceraResumen {
  rucEmisor: string;
  razonSocialEmisor: string;
  /** Identificador del resumen: el correlativo que el usuario elige. */
  correlativo: number;
  /** Fecha de los comprobantes, YYYY-MM-DD. */
  fechaResumen: string;
  fechaGeneracion: string;
}

/** Escapa los caracteres reservados del XML. */
export const esc = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * ¿El comprobante puede ir en un resumen diario?
 *
 * Las boletas y sus notas sí; las facturas NO: se envían individualmente con
 * `sendBill` y meterlas aquí hace rechazar el resumen completo.
 */
export const vaEnResumen = (c: ComprobanteAgregado): boolean => {
  if (!TIPOS_EN_RESUMEN.includes(c.tipoComprobante)) return false;
  // Una nota a factura lleva serie FC/FD y no pertenece al resumen de boletas.
  if (c.tipoComprobante === '07' || c.tipoComprobante === '08') {
    return c.serie.toUpperCase().startsWith('B');
  }
  return true;
};

/**
 * Estados en los que el comprobante YA tiene una respuesta de SUNAT que lo
 * tiene por informado.
 *
 * `ACEPTADO` es el caso normal. `OBSERVADO` también cuenta: SUNAT devolvió un
 * CDR con observaciones, es decir, lo RECIBIÓ y lo tiene registrado. Volver a
 * informarlo por resumen sería un segundo envío del mismo documento.
 *
 * `RECHAZADO` NO está aquí: no fue aceptado y su caso se trata aparte.
 */
export const ESTADOS_YA_INFORMADOS: readonly string[] = [
  'ACEPTADO',
  'OBSERVADO',
];

/**
 * ¿El comprobante debe excluirse del resumen?
 *
 * Lo rechazado no existe ante SUNAT y lo anulado ya se informó como baja:
 * incluirlo resucitaría un comprobante que el contribuyente quiso retirar.
 *
 * D11: tampoco entra lo que SUNAT YA INFORMÓ por otra vía. Una boleta enviada
 * individualmente (sendBill) y aceptada tiene su propio CDR; meterla además en
 * el resumen diario la declararía dos veces ante la administración. Se detectó
 * comprobando la vista previa antes de conectar el botón de envío: proponía
 * informar `B001-3` y `B001-4`, ambas ya ACEPTADAS.
 *
 * Se excluye aquí, en la función ÚNICA que decide, y no en la pantalla: así la
 * vista previa y el envío real no pueden discrepar, y el usuario ve la línea
 * con su motivo en lugar de que desaparezca sin explicación.
 */
export const excluidoDelResumen = (c: ComprobanteAgregado): boolean =>
  ['RECHAZADO', 'ANULADO'].includes(c.estado) ||
  ESTADOS_YA_INFORMADOS.includes(c.estado);

/**
 * Motivo por el que un comprobante ya informado queda fuera del resumen.
 *
 * Se devuelve como texto para que la pantalla lo muestre tal cual; sin el
 * motivo, el usuario emite una boleta, no la ve en el resumen y concluye que el
 * sistema la perdió.
 */
export const motivoYaInformado = (c: ComprobanteAgregado): string =>
  c.estado === 'OBSERVADO'
    ? 'SUNAT ya lo recibió con observaciones: volver a informarlo lo duplicaría.'
    : 'SUNAT ya lo aceptó con su CDR: volver a informarlo lo duplicaría.';


/** Redondeo a céntimos. */


/**
 * Plazo máximo, en días calendario, para informar un comprobante (regla 2957).
 *
 * SUNAT rechaza el resumen diario cuando la fecha de referencia quedó fuera de
 * este plazo: "El archivo fue enviado fuera del plazo establecido". El plazo
 * corre desde la fecha de emisión del comprobante, no desde que el usuario se
 * acuerda de enviarlo.
 */
export const DIAS_MAXIMOS_RESUMEN = 7;

/** Un día en milisegundos. */
const DIA_MS = 24 * 60 * 60 * 1000;

/** Convierte YYYY-MM-DD a UTC a medianoche; `null` si la forma no es válida. */
const aFechaUtc = (fecha: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return null;
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Días calendario transcurridos entre la emisión y la fecha de referencia.
 *
 * Se calcula sobre fechas UTC a medianoche y no sobre instantes: si se restaran
 * horas, un comprobante emitido a las 23:00 del día 1 y resumido a las 00:30 del
 * día 2 contaría como "un día" cuando en realidad ya se pasó de fecha, y el
 * rechazo por plazo llegaría sin aviso.
 */
export const diasDesdeEmision = (
  fechaEmision: string,
  fechaReferencia: string,
): number | null => {
  const emision = aFechaUtc(fechaEmision);
  const referencia = aFechaUtc(fechaReferencia);
  if (!emision || !referencia) return null;
  return Math.round((referencia.getTime() - emision.getTime()) / DIA_MS);
};

/**
 * Comprueba la regla 2957 para un conjunto de comprobantes.
 *
 * @throws BadRequestException si alguno quedó fuera del plazo, nombrando los
 *   vencidos: mandar el resumen asumiendo que SUNAT lo acepta solo sirve para
 *   descubrir el rechazo cuando el ticket ya se gastó.
 */
export const validarPlazoResumen = (
  comprobantes: readonly ComprobanteAgregado[],
  fechaReferencia: string,
): void => {
  const vencidos = comprobantes
    .filter((c) => !excluidoDelResumen(c))
    .map((c) => ({ c, dias: diasDesdeEmision(c.fechaEmision, fechaReferencia) }))
    .filter((x) => x.dias !== null && x.dias > DIAS_MAXIMOS_RESUMEN);

  if (vencidos.length === 0) return;

  const { c, dias } = vencidos[0];
  const resto =
    vencidos.length > 1
      ? ` Hay ${vencidos.length} comprobantes fuera de plazo en total.`
      : '';

  throw new BadRequestException({
    code: 'RESUMEN_FUERA_DE_PLAZO',
    message:
      `El comprobante ${c.serie}-${c.correlativo} se emitió el ${c.fechaEmision} ` +
      `y ${dias} días antes de la fecha del resumen: la regla 2957 solo admite ` +
      `${DIAS_MAXIMOS_RESUMEN} días calendario.${resto}`,
  });
};

/**
 * Regla 2308: una **comunicación de baja (RA) no puede llevar boletas**.
 *
 * Las boletas se anulan por el resumen diario (RC), restando su importe en un
 * resumen posterior; la RA existe solo para facturas y notas. Mandar una boleta
 * en una RA es rechazo seguro y además no anula nada, porque SUNAT no espera
 * encontrarla ahí.
 */
export const TIPOS_EN_BAJA: readonly string[] = ['01', '07', '08'];

/** ¿El comprobante puede ir en una comunicación de baja? */
export const vaEnBaja = (c: ComprobanteAgregado): boolean =>
  TIPOS_EN_BAJA.includes(c.tipoComprobante);

/**
 * Valida la regla 2308 para un conjunto de bajas.
 *
 * @throws BadRequestException si aparece una boleta (03) u otro tipo que no se
 *   anula por RA.
 */
export const validarTiposEnBaja = (
  comprobantes: readonly ComprobanteAgregado[],
): void => {
  const fuera = comprobantes.filter((c) => !vaEnBaja(c));
  if (fuera.length === 0) return;

  const c = fuera[0];
  const esBoleta = c.tipoComprobante === '03';

  throw new BadRequestException({
    code: 'BAJA_TIPO_INVALIDO',
    message: esBoleta
      ? `La boleta ${c.serie}-${c.correlativo} no se puede dar de baja con una ` +
        'comunicación RA (regla 2308): las boletas se anulan en el resumen ' +
        'diario, restándolas en un resumen posterior.'
      : `El comprobante ${c.serie}-${c.correlativo} de tipo ${c.tipoComprobante} ` +
        'no se da de baja por comunicación RA: solo las facturas (01) y sus ' +
        'notas (07/08).',
  });
};

/**
 * Bloque de un comprobante dentro de `SummaryDocuments`.
 *
 * ELEMENTOS EN EL NAMESPACE `sac:` (SunatAggregateComponents-1):
 * `SummaryDocumentsLine`, `TotalAmount` y `BillingPayment`. Con `cac:` SUNAT
 * rechaza el archivo entero:
 *   "found <cac:SummaryDocumentsLine> (in namespace ...CommonAggregateComponents-2),
 *    but next item should be {...SunatAggregateComponents-1}SummaryDocumentsLine"
 *
 * `sac:BillingPayment` SOLO admite `cbc:InstructionID`. Por el tipo
 * `PaymentType` del esquema no se puede añadir nada después: tanto
 * `cbc:PaidAmount` como `cbc:Amount` fueron rechazados contra BETA con
 *   "...found <cbc:Amount> ..., but next item should be end-element"
 * El importe ya va en `sac:TotalAmount` (total) y en el `TaxTotal` (base e IGV),
 * así que el pago solo declara su instrucción.
 */
const lineaResumen = (c: ComprobanteAgregado): string => {
  const numero = `${c.serie}-${String(c.correlativo).padStart(8, '0')}`;
  const total = r2(c.total);
  const igv = r2(c.igv);
  const base = r2(total - igv);

  // `sac:SummaryDocumentsLine` — el elemento va en el namespace de SUNAT
  // (SunatAggregateComponents-1), NO en el de UBL. Con `cac:` el validador de
  // SUNAT responde, rechazando el archivo completo:
  //   "found <cac:SummaryDocumentsLine> (in namespace ...CommonAggregateComponents-2),
  //    but next item should be {...SunatAggregateComponents-1}SummaryDocumentsLine"
  // Se comprobó enviando de verdad a BETA el 01-11.
  return `    <sac:SummaryDocumentsLine>
      <cbc:LineID>${esc(c.serie)}</cbc:LineID>
      <cbc:DocumentTypeCode>${esc(c.tipoComprobante)}</cbc:DocumentTypeCode>
      <cbc:ID>${esc(numero)}</cbc:ID>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyIdentification>
            <cbc:ID schemeID="${esc(c.tipoDocCliente)}">${esc(c.numDocCliente)}</cbc:ID>
          </cac:PartyIdentification>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:Status>
        <cbc:ConditionCode>1</cbc:ConditionCode>
      </cac:Status>
      <sac:TotalAmount currencyID="PEN">${total.toFixed(2)}</sac:TotalAmount>
      <sac:BillingPayment>
        <cbc:InstructionID>01</cbc:InstructionID>
      </sac:BillingPayment>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="PEN">${base.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cac:TaxScheme>
              <cbc:ID>1000</cbc:ID>
              <cbc:Name>IGV</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
    </sac:SummaryDocumentsLine>`;
};

/**
 * Genera el XML `SummaryDocuments` (resumen diario de boletas).
 *
 * @throws BadRequestException si no queda ningún comprobante que resumir o si
 *   se coló una factura.
 */
export const construirResumenDiario = (
  cabecera: CabeceraResumen,
  comprobantes: readonly ComprobanteAgregado[],
): string => {
  const facturas = comprobantes.filter((c) => !vaEnResumen(c));
  if (facturas.length > 0) {
    const numero = `${facturas[0].serie}-${facturas[0].correlativo}`;
    throw new BadRequestException({
      code: 'RESUMEN_TIPO_INVALIDO',
      message:
        `El comprobante ${numero} no pertenece a un resumen diario: solo las ` +
        'boletas (03) y sus notas se envían agrupadas. Las facturas se envían ' +
        'individualmente con sendBill.',
    });
  }

  const incluidos = comprobantes.filter((c) => !excluidoDelResumen(c));

  if (incluidos.length === 0) {
    throw new BadRequestException({
      code: 'RESUMEN_VACIO',
      message:
        'El resumen no tiene comprobantes que informar: todas las filas están ' +
        'rechazadas o anuladas.',
    });
  }

  // Regla 2957: el plazo se comprueba sobre lo que realmente se va a enviar.
  validarPlazoResumen(incluidos, cabecera.fechaResumen);

  const fecha = cabecera.fechaResumen;
  // REGLA 2346: la fecha del identificador debe ser la de GENERACIÓN del
  // resumen, no la de referencia. `cbc:ID` y `cbc:IssueDate` tienen que llevar
  // el mismo día. Con la fecha de referencia (05-11) y hoy (01-11) SUNAT
  // respondía:
  //   "2346 - La fecha de generación del resumen debe ser igual a la fecha
  //    consignada en el nombre del archivo"
  // La fecha de los comprobantes agrupados va aparte, en `cbc:ReferenceDate`.
  const fechaGeneracion = cabecera.fechaGeneracion || fecha;
  const identificador = `RC-${fechaGeneracion.replace(/-/g, '')}-${String(cabecera.correlativo).padStart(3, '0')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>${esc(identificador)}</cbc:ID>
  <cbc:ReferenceDate>${esc(fecha)}</cbc:ReferenceDate>
  <cbc:IssueDate>${esc(cabecera.fechaGeneracion)}</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${esc(cabecera.rucEmisor)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(cabecera.razonSocialEmisor)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${incluidos.map(lineaResumen).join('\n')}
</SummaryDocuments>`;
};

/**
 * Bloque de un comprobante dentro de `VoidedDocuments`.
 *
 * `sac:VoidedDocumentsLine` — igual que en el resumen diario, el elemento va en
 * el namespace de SUNAT (SunatAggregateComponents-1) y no en el de UBL.
 */
const lineaBaja = (c: ComprobanteAgregado, index: number): string => `    <sac:VoidedDocumentsLine>
      <cbc:LineID>${index + 1}</cbc:LineID>
      <cbc:DocumentTypeCode>${esc(c.tipoComprobante)}</cbc:DocumentTypeCode>
      <sac:DocumentSerialID>${esc(c.serie)}</sac:DocumentSerialID>
      <sac:DocumentNumberID>${c.correlativo}</sac:DocumentNumberID>
      <sac:VoidReasonDescription>${esc(c.motivoBaja ?? 'Anulación de la operación')}</sac:VoidReasonDescription>
    </sac:VoidedDocumentsLine>`;

/**
 * Genera el XML `VoidedDocuments` (comunicación de baja).
 *
 * @throws BadRequestException si algún comprobante no está en un estado que
 *   admita baja. Dar de baja algo que SUNAT todavía no aceptó es un rechazo
 *   seguro y, peor, deja el comprobante en un limbo.
 */
export const construirComunicacionBaja = (
  cabecera: CabeceraResumen,
  comprobantes: readonly ComprobanteAgregado[],
): string => {
  if (comprobantes.length === 0) {
    throw new BadRequestException({
      code: 'BAJA_VACIA',
      message: 'La comunicación de baja no tiene comprobantes.',
    });
  }

  // Regla 2308: una RA no lleva boletas. Se comprueba antes que el estado
  // porque el tipo es un error de diseño de la operación, no un problema de
  // sincronización: esperar a que la boleta esté aceptada para rechazarla solo
  // retrasa el aviso.
  validarTiposEnBaja(comprobantes);

  const noDables = comprobantes.filter(
    (c) => !ESTADOS_DADOS_DE_BAJA_VALIDOS.includes(c.estado),
  );
  if (noDables.length > 0) {
    const c = noDables[0];
    throw new BadRequestException({
      code: 'BAJA_ESTADO_INVALIDO',
      message:
        `El comprobante ${c.serie}-${c.correlativo} está en estado ${c.estado}: ` +
        'solo se puede dar de baja un comprobante aceptado u observado por SUNAT.',
    });
  }

  // Misma regla 2346 que en el resumen diario: el identificador lleva la fecha
  // de GENERACIÓN, que es la que también va en `cbc:IssueDate`.
  const fechaGenBaja = cabecera.fechaGeneracion || cabecera.fechaResumen;
  const identificador = `RA-${fechaGenBaja.replace(/-/g, '')}-${String(cabecera.correlativo).padStart(3, '0')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${esc(identificador)}</cbc:ID>
  <cbc:ReferenceDate>${esc(cabecera.fechaResumen)}</cbc:ReferenceDate>
  <cbc:IssueDate>${esc(cabecera.fechaGeneracion)}</cbc:IssueDate>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${esc(cabecera.rucEmisor)}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(cabecera.razonSocialEmisor)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
${comprobantes.map(lineaBaja).join('\n')}
</VoidedDocuments>`;
};
