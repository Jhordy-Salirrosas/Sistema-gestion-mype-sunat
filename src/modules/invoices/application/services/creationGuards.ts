import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';
import type { CreateInvoiceDto } from '../dto/createInvoiceDto';
import { AFECTACIONES_GRILLA } from '../dto/emitirComprobanteDto';
import { traducirEmision } from './emitirComprobanteAdapter';
import { CATALOGO_09_MOTIVOS } from './invoiceNoteService';
import { validarPago } from './paymentTermsAndSpotValidator';
import { ESTADOS_NOTABLES } from './creditNoteBalanceGuard';
import { resolverRetencionMaestro } from './retencionMaestro';
import type { PrismaService } from '../../../../database/prismaService';

/** Datos fiscales de la integración convertidos al mismo contrato de negocio. */
export function fiscalToEmission(dto: CreateInvoiceDto): EmitirComprobanteDto {
  const p = dto.payload_ubl as any;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new BadRequestException('Payload fiscal inválido');
  if (p.tipoComprobante !== dto.tipo_comprobante || p.serie !== dto.serie ||
    p.fechaEmision !== dto.fecha_emision.slice(0, 10) || p.rucEmisor !== dto.ruc_emisor) {
    throw new BadRequestException('La cabecera y el payload fiscal no coinciden');
  }
  if (!['Contado', 'Credito'].includes(p.formaPago)) throw new BadRequestException('La forma de pago fiscal es obligatoria');
  if (!Array.isArray(p.lineas) || p.lineas.length === 0) throw new BadRequestException('El payload fiscal requiere líneas reales');
  if (p.tipoMoneda !== 'PEN') throw new BadRequestException('La emisión M1 requiere moneda PEN explícita');
  if (p.cliente && (p.cliente.numeroDocumento !== dto.customer_identity_number ||
    p.cliente.tipoDocumento !== dto.customer_identity_type || p.cliente.razonSocial !== dto.customer_legal_name)) {
    throw new BadRequestException('El adquirente del payload no coincide con la cabecera');
  }
  if (p.cuotas != null && !Array.isArray(p.cuotas)) throw new BadRequestException('Las cuotas fiscales deben ser un arreglo');
  const cuotas = p.cuotas?.map((c: any, i: number) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new BadRequestException('Cuota fiscal inválida');
    if (c.numero !== undefined && c.numero !== `Cuota${String(i + 1).padStart(3, '0')}`) throw new BadRequestException('La numeración del cronograma no coincide con sus cuotas');
    return { monto: c.monto, vencimiento: c.vencimiento };
  });
  return {
    tipo_comprobante: dto.tipo_comprobante as EmitirComprobanteDto['tipo_comprobante'], serie: dto.serie,
    fecha_emision: dto.fecha_emision, customer_identity_type: dto.customer_identity_type,
    customer_identity_number: dto.customer_identity_number, customer_legal_name: dto.customer_legal_name!,
    almacen: p.almacen,
    forma_pago: p.formaPago, cuotas, descuento_global: p.descuentoGlobal,
    medio_pago_detraccion: p.medioPagoDetraccion, cuenta_banco_nacion: p.cuentaBancoNacion,
    documento_afectado: p.documentoAfectado, referenced_invoice_id: dto.referenced_invoice_id,
    codigo_motivo_nota: p.codigoMotivoNota, descripcion_motivo_nota: p.descripcionMotivoNota,
    items: p.lineas.map((l: any) => {
      if (!l || typeof l !== 'object') throw new BadRequestException('Línea fiscal inválida');
      if (l.descuentos !== undefined && l.descuentos !== null && !Array.isArray(l.descuentos)) throw new BadRequestException('La lista de descuentos de línea debe ser un arreglo');
      if ((l.descuentos?.length ?? 0) > 1) throw new BadRequestException('Una línea admite un descuento explícito');
      if (p.codigoDetraccion && !l.codigoDetraccion) throw new BadRequestException('La afectación SPOT debe constar por línea');
      return { codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad,
        precioUnitario: l.precioUnitario, valorUnitario: l.valorUnitario, unidad: l.unidad,
        afectacion: l.afectacion, descuento: l.descuentos?.[0], icbper: l.icbperLinea, cantidadBolsas: l.cantidadBolsas,
        codigoDetraccion: l.codigoDetraccion };
    }),
  };
}

export async function prepareCreation(tx: Prisma.TransactionClient, input: EmitirComprobanteDto,
  companyId: string): Promise<EmitirComprobanteDto> {
  const validable = plainToInstance(EmitirComprobanteDto, input);
  const errors = validateSync(validable, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, validationError: { target: false, value: false } });
  if (errors.length) throw new BadRequestException({ code: 'EMISSION_INPUT_INVALID', message: 'Datos de emisión inválidos', campos: errors.map((e) => e.property) });
  const dto = structuredClone(input);
  if (!['Contado', 'Credito'].includes(dto.forma_pago as string) && ['01', '03'].includes(dto.tipo_comprobante)) {
    throw new BadRequestException('Indique la forma de pago; no se presume Contado');
  }
  const almacen = (dto.almacen ?? 'ALM-01').trim().toUpperCase();
  const warehouse = await tx.inventoryWarehouse.findFirst({ where: { company_id: companyId, warehouse_code: almacen, is_active: true }, select: { id: true } });
  if (!warehouse) throw new BadRequestException(`Almacén no disponible en la empresa: ${almacen}`);
  dto.almacen = almacen;
  const codigos = dto.items.map((l) => l.codigo?.trim());
  if (codigos.some((c) => !c)) throw new BadRequestException('Cada producto o servicio debe estar registrado con código y afectación');
  const esNota = dto.tipo_comprobante === '07' || dto.tipo_comprobante === '08';
  let historicas: { item_code: string | null; unit_code: string | null; igv_affectation_type: string | null }[] = [];
  if (esNota) {
    const numero = /^([A-Za-z0-9]{4})-(\d{1,8})$/.exec(dto.documento_afectado?.trim() ?? '');
    if (numero || dto.referenced_invoice_id) {
      const origen = await tx.invoice.findFirst({ where: { company_id: companyId,
        ...(dto.referenced_invoice_id ? { id: dto.referenced_invoice_id } : { serie: numero![1], correlativo: Number(numero![2]) }) },
        select: { items: { select: { item_code: true, unit_code: true, igv_affectation_type: true } } } });
      if (!origen) throw new NotFoundException('Comprobante origen no encontrado en la empresa');
      historicas = origen.items ?? [];
    }
  }
  const productos = await tx.inventoryProduct.findMany({ where: {
    company_id: companyId, sku: { in: codigos as string[] }, ...(esNota ? {} : { is_active: true }),
  }, select: { sku: true, tax_affectation: true, sunat_unit_code: true, is_active: true, sale_price: true } });
  for (const l of dto.items) {
    const producto = productos.find((p) => p.sku === l.codigo!.trim());
    if (!producto) throw new BadRequestException(`Producto o servicio no registrado: ${l.codigo}`);
    if (!esNota && (!Number.isFinite(Number(producto.sale_price)) || !(Number(producto.sale_price) > 0))) throw new BadRequestException(`Producto ${l.codigo} sin precio de venta configurado`);
    const candidatas = historicas.filter(h => h.item_code === l.codigo!.trim());
    const historica = candidatas.find(h => (!l.afectacion || l.afectacion === h.igv_affectation_type) && (!l.unidad || l.unidad === h.unit_code));
    if ((candidatas.length && !historica) || (producto.is_active === false && !historica)) throw new BadRequestException('La línea inactiva o histórica debe corresponder al comprobante origen');
    const afectacion = (historica ? historica.igv_affectation_type : producto.tax_affectation)?.trim();
    const unidad = historica ? historica.unit_code : producto.sunat_unit_code;
    if (!unidad?.trim()) throw new BadRequestException('La línea no tiene unidad fiscal registrada');
    if (!afectacion || !(AFECTACIONES_GRILLA as readonly string[]).includes(afectacion)) {
      throw new BadRequestException(`Producto ${l.codigo} sin afectación tributaria válida`);
    }
    if (l.afectacion && l.afectacion !== afectacion) throw new BadRequestException('No puede alterar la afectación del producto');
    if (l.unidad && l.unidad !== unidad) throw new BadRequestException('No puede alterar la unidad del producto');
    if (!Number.isFinite(l.precioUnitario)) {
      throw new BadRequestException('Indique precio unitario con IGV y cantidad válidos');
    }
    if (!esNota && !new Prisma.Decimal(producto.sale_price!).equals(l.precioUnitario!)) {
      throw new BadRequestException(`El precio de venta de ${l.codigo} cambió o no coincide con el configurado; actualice el catálogo`);
    }
    l.afectacion = afectacion;
    l.unidad = unidad;
  }
  const descuento = Boolean(dto.descuento_global) || dto.items.some((l) => Boolean(l.descuento));
  if (dto.forma_pago === 'Credito' || descuento) {
    const cliente = await tx.businessPartner.findFirst({ where: { company_id: companyId,
      doc_type: dto.customer_identity_type, doc_number: dto.customer_identity_number, is_active: true },
    select: { has_credit: true, allows_discount: true } });
    if (!dto.customer_identity_number || !dto.customer_identity_type || !cliente ||
      (dto.forma_pago === 'Credito' && cliente.has_credit !== true) ||
      (descuento && cliente.allows_discount !== true)) throw new BadRequestException('El maestro no autoriza crédito o descuentos para este cliente');
  }
  if (dto.tipo_comprobante === '07' || dto.tipo_comprobante === '08') {
    const numero = /^([A-Za-z0-9]{4})-(\d{1,8})$/.exec(dto.documento_afectado?.trim() ?? '');
    if (!numero && !dto.referenced_invoice_id) throw new BadRequestException('Una nota exige comprobante origen válido');
    const origen = await tx.invoice.findFirst({ where: { company_id: companyId,
      ...(dto.referenced_invoice_id ? { id: dto.referenced_invoice_id } : { serie: numero![1], correlativo: Number(numero![2]) }),
    } });
    if (!origen) throw new NotFoundException('Comprobante origen no encontrado en la empresa');
    // Serializa las notas de un mismo origen antes de leer estado y saldo.
    await tx.$executeRaw`SELECT id FROM invoices WHERE id = ${origen.id} AND company_id = ${companyId} FOR UPDATE`;
    const actual = await tx.invoice.findFirst({ where: { id: origen.id, company_id: companyId } });
    if (!actual || !ESTADOS_NOTABLES.includes(actual.estado) || !['01', '03'].includes(actual.tipo_comprobante)) {
      throw new BadRequestException('El origen debe ser factura o boleta aceptada u observada por SUNAT');
    }
    const bajas = await tx.invoiceAggregate?.findMany({ where: { company_id: companyId, kind: 'RA', state: { notIn: ['BLOCKED', 'REJECTED'] } }, select: { members: true } }) ?? [];
    if (bajas.some(b => (b.members as unknown as { id: string }[]).some(m => m.id === actual.id))) throw new ConflictException('BAJA_EN_PROCESO');
    const referencia = `${actual.serie}-${String(actual.correlativo).padStart(8, '0')}`;
    if (numero && (numero[1] !== actual.serie || Number(numero[2]) !== actual.correlativo)) throw new BadRequestException('UUID y número de origen no coinciden');
    if (actual.customer_identity_number !== (dto.customer_identity_number ?? null) || actual.customer_identity_type !== (dto.customer_identity_type ?? null)) {
      throw new BadRequestException('La nota y su origen deben tener el mismo adquirente');
    }
    dto.referenced_invoice_id = actual.id;
    dto.documento_afectado = referencia;
    if (dto.tipo_comprobante === '07') {
      const notas = await tx.invoice.findMany({ where: { company_id: companyId,
        referenced_invoice_id: actual.id, tipo_comprobante: '07', estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
      select: { monto_total: true } });
      const disponible = Math.round(Number(actual.monto_total) * 100) - notas.reduce((s, n) => s + Math.round(Number(n.monto_total) * 100), 0);
      const importe = traducirEmision(dto, { ruc: '', razonSocial: '' }, 0).importes.total;
      if (Math.round(importe * 100) > disponible) throw new ConflictException('NOTA_EXCEDE_SALDO');
      if (CATALOGO_09_MOTIVOS.find(m => m.codigo === dto.codigo_motivo_nota)?.total && Math.round(importe * 100) !== disponible) {
        throw new BadRequestException('El motivo de nota exige devolver el saldo disponible total');
      }
    }
  }
  if (dto.tipo_comprobante === '01' || dto.tipo_comprobante === '03') {
    const fecha = new Date((dto.fecha_emision ?? new Date().toISOString()).slice(0, 10) + 'T00:00:00Z');
    const retencion = await resolverRetencionMaestro(tx as unknown as PrismaService, { companyId,
      tipo: dto.customer_identity_type, numero: dto.customer_identity_number, fecha,
      enviado: dto.agente_retencion, correccion: dto.correccion_retencion });
    dto.agente_retencion = retencion.aplica;
  }
  const liquidado = traducirEmision(dto, { ruc: '', razonSocial: '' }, 0);
  validarPago({ formaPago: dto.forma_pago, cuotas: liquidado.dto.payload_ubl.cuotas as any,
    fechaEmision: liquidado.dto.payload_ubl.fechaEmision as string, montoTotal: liquidado.importes.total,
    detraccion: liquidado.importes.detraccion, retencion: liquidado.importes.retencion });
  return dto;
}
