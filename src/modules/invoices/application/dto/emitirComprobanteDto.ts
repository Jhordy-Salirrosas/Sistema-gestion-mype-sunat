/**
 * DTO de la emisión desde la PANTALLA (M1, corrección del docente 31-10).
 *
 * POR QUÉ EXISTE ESTE DTO Y NO SE REUTILIZA `CreateInvoiceDto`
 *
 * `CreateInvoiceDto` es el contrato del sistema que ya tiene el XML armado:
 * exige `payload_ubl`, `correlativo` y `monto_total`. Eso está bien para una
 * integración máquina-a-máquina, pero una persona en el mostrador no tiene un
 * XML ni debe elegir el correlativo: escribe el cliente, la serie y las líneas.
 *
 * Hasta ahora el front mandaba `{serie, clienteRuc, items...}` contra un
 * endpoint que exigía `{ruc_emisor, tipo_comprobante, payload_ubl...}`. El
 * resultado no era un error de dedo: el `whitelistValidation` del ValidationPipe
 * rechazaba TODAS las peticiones con 400 "property clienteRuc should not exist".
 * Es decir, la pantalla de emisión nunca pudo emitir nada. Se comprobó contra el
 * servidor real antes de escribir esto.
 *
 * La solución no es relajar `CreateInvoiceDto` (perdería las validaciones
 * fiscales que SUNAT necesita), sino aceptar la forma del formulario en un DTO
 * propio y TRADUCIRLO al contrato fiscal en `emitirComprobanteAdapter`. Así el
 * camino de la pantalla y el de la integración convergen en el mismo generador
 * UBL, que es lo que garantiza que un comprobante emitido a mano y uno emitido
 * por integración salgan iguales.
 */
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { CATALOGO_59_MEDIOS_PAGO, type MedioPagoDetraccion } from '../../domain/rules/medioPagoDetraccion';

/** Tipos que pueden emitirse desde la pantalla. */
export const TIPOS_EMISION_PANTALLA = ['01', '03', '07', '08'] as const;
export type TipoEmisionPantalla = (typeof TIPOS_EMISION_PANTALLA)[number];

/** Afectaciones del Catálogo 07 admitidas en la grilla. */
export const AFECTACIONES_GRILLA = [
  '10', '11', '12', '13', '14', '15', '16',
  '20', '21',
  '30', '31', '32', '33', '34', '35', '36', '37',
  '40',
] as const;

/** Una cuota del cronograma de una venta al crédito (TA-63). */
export class CuotaEmisionDto {
  /** Monto de la cuota, con impuestos. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  /** Vencimiento `YYYY-MM-DD`, posterior a la fecha de emisión (regla 3267). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'El vencimiento de la cuota debe tener el formato YYYY-MM-DD',
  })
  @IsDateString({ strict: true })
  vencimiento: string;
}

/** Descuento de línea del Catálogo 53. */
export class DescuentoLineaEmisionDto {
  @IsIn(['00', '01'])
  codigo: '00' | '01';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;
}

/** Descuento de cabecera; 04 no es operativo sin registro de anticipos. */
export class DescuentoGlobalEmisionDto {
  @IsIn(['02', '03'])
  codigo: '02' | '03';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;
}

/** Una línea de la grilla de emisión. */
export class LineaEmisionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'La descripción no puede quedar en blanco' })
  descripcion: string;

  /**
   * SKU del producto. Es lo que permite validar el stock y generar el
   * movimiento de Kardex: el docente lo dijo así, "supone que esos productos o
   * servicios los tienes dentro de tu inventario". Opcional para que se pueda
   * facturar un servicio, que no vive en el almacén.
   */
  @IsOptional()
  @IsString()
  codigo?: string;

  /** Unidad del Catálogo 03 (NIU, KGM, DZN, CEN...). */
  @IsOptional()
  @IsString()
  @Length(1, 3)
  unidad?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  cantidad: number;

  /** Valor unitario SIN IGV (opcional cuando se envía precioUnitario con IGV). */
  @ValidateIf((o: LineaEmisionDto) => o.precioUnitario === undefined || o.valorUnitario !== undefined)
  @IsNumber({ maxDecimalPlaces: 10 })
  @Min(0)
  valorUnitario: number;

  /** Precio unitario final CON IGV incluido digitado en la venta. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsIn(AFECTACIONES_GRILLA as unknown as string[])
  afectacion?: string;

  /** Descuento explícito; null indica que no se registró uno. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DescuentoLineaEmisionDto)
  descuento?: DescuentoLineaEmisionDto | null;

  /** Código del Catálogo 54 cuando la línea está sujeta a detracción. */
  @IsOptional()
  @IsString()
  codigoDetraccion?: string;

  /** ICBPER de la línea cuando es una bolsa plástica (S/ 0.50 por bolsa). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  icbper?: number;

  /** Cantidad explícita de bolsas entregadas; el servidor calcula S/ 0.50 por bolsa. */
  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadBolsas?: number;
}

/**
 * Alta de comprobante tal como la llena el usuario.
 *
 * Los campos de importe (`monto_total`, `monto_gravado`, `monto_igv`) NO se
 * piden: los liquida el backend a partir de las líneas. Aceptarlos del cliente
 * permitiría que el XML declarara ante SUNAT un total distinto del que suman
 * sus propias líneas, que es el descuadre más caro de detectar.
 */
export class EmitirComprobanteDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  almacen?: string;

  /** Obligatorio con detracción efectiva; se valida tras liquidar las líneas. */
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsIn(Object.keys(CATALOGO_59_MEDIOS_PAGO))
  medio_pago_detraccion?: MedioPagoDetraccion;

  @IsIn(TIPOS_EMISION_PANTALLA as unknown as string[])
  tipo_comprobante: TipoEmisionPantalla;

  @Matches(/^[A-Za-z0-9]{4}$/, {
    message: 'La serie debe ser de 4 caracteres alfanuméricos (F001, B001, FC01...)',
  })
  serie: string;

  /**
   * Documento del adquirente. Obligatorio para factura (RUC); para boleta
   * depende del importe, y eso lo decide `validarAdquirente`, no el DTO.
   */
  @IsOptional()
  @IsString()
  customer_identity_number?: string;

  /** Tipo del Catálogo 06: 1 DNI, 6 RUC, 0 Sin documento. */
  @IsOptional()
  @IsString()
  @Length(1, 1)
  customer_identity_type?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El nombre del adquirente no puede quedar en blanco' })
  customer_legal_name: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fecha_emision?: string;

  /** El cliente es agente de retención: se le retiene el 3 % del IGV. */
  @IsOptional()
  @IsBoolean()
  agente_retencion?: boolean;

  /** La persona modificó expresamente la selección sugerida por el maestro. */
  @IsOptional()
  @IsBoolean()
  correccion_retencion?: boolean;

  /** Forma de pago; con 'Credito' se requiere al menos una cuota. */
  @IsOptional()
  @IsIn(['Contado', 'Credito'])
  forma_pago?: 'Contado' | 'Credito';

  /**
   * Cronograma de la venta al crédito.
   *
   * El generador UBL (`bloqueFormaPago`) ya sabía escribir los
   * `cac:PaymentTerms` de Cuota001..N y el validador ya comprobaba las reglas
   * 3267 y 3319, pero el contrato de la pantalla no tenía por dónde recibirlas:
   * el formulario emitía siempre al contado. Sin este campo, `forma_pago:
   * 'Credito'` pasaba la validación del DTO y llegaba al generador sin cuotas.
   */
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CuotaEmisionDto)
  cuotas?: CuotaEmisionDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DescuentoGlobalEmisionDto)
  descuento_global?: DescuentoGlobalEmisionDto | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'El comprobante necesita al menos una línea' })
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => LineaEmisionDto)
  items: LineaEmisionDto[];

  /**
   * Notas de crédito (07) y débito (08): comprobante que modifican.
   *
   * El docente fue explícito: "es sobre el documento que ya está, no empiezas
   * haciendo una nota de crédito". Por eso el servicio rechaza una nota sin
   * referencia, y además comprueba que el documento exista en la empresa.
   */
  @IsOptional()
  @IsString()
  documento_afectado?: string;

  /** Motivo del Catálogo 09; obligatorio en notas. */
  @IsOptional()
  @IsString()
  codigo_motivo_nota?: string;

  @IsOptional()
  @IsString()
  descripcion_motivo_nota?: string;

  /**
   * UUID del comprobante que la nota modifica (TA-66). NO lo manda el cliente.
   *
   * Lo escribe `verificarDocumentoOrigen()` sobre el DTO, porque es la única
   * parte del flujo que resuelve la fila real a partir del número fiscal. Si se
   * aceptara del formulario, un usuario podría apuntar a un comprobante de otra
   * empresa y falsear el saldo. Termina en la columna `referenced_invoice_id`,
   * que es la clave con la que `ControlSaldoNotas` suma las notas anteriores.
   */
  @IsOptional()
  @IsString()
  referenced_invoice_id?: string;

  /**
   * Cuenta del Banco de la Nación del EMISOR para depositar la detracción.
   *
   * Obligatoria cuando alguna línea lleva código del Catálogo 54: SUNAT rechaza
   * con 3034 si el XML no la trae. Es un dato de la empresa, no del comprobante,
   * así que viaja en la cabecera del alta y no en la línea.
   */
  @IsOptional()
  @IsString()
  @Length(1, 20)
  cuenta_banco_nacion?: string;
}
