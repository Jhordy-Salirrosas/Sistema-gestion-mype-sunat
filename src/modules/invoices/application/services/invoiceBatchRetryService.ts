import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/client/client';
import { PrismaService } from '../../../../database/prismaService';
import { QueueService } from '../../../resilience/infrastructure/queue/queue.service';
import { presentarResultado } from './invoiceResultPresentation';
import { aCdr, numeroComprobante } from './invoiceQueryMapper';
import type { DetalleReintentoMasivo, ReintentoMasivoDto } from '../dto/invoiceBatchRetryDto';

export const SELECT_REENVIO = {
  id:true, estado:true, serie:true, correlativo:true, transport_uncertain:true, cdr_sunat:true,
  history:{ orderBy:{created_at:'desc' as const}, select:{estado_nuevo:true,codigo_error:true,mensaje_error:true,created_at:true} },
} as const;
type Fila = Prisma.InvoiceGetPayload<{select: typeof SELECT_REENVIO}>;
const ESTADOS = ['EN_COLA','PENDIENTE','ERROR_RED','ENVIADO','RECHAZADO','PROCESANDO'] as const;

/** Decisión de elegibilidad; no cambia el estado fiscal ni autoriza reenvíos forzados. */
export function clasificarReintentoMasivo(fila: Fila): DetalleReintentoMasivo {
  const base={id:fila.id,numero:numeroComprobante(fila.serie,fila.correlativo),estado:fila.estado};
  if (fila.transport_uncertain === true) return {...base,resultado:'OMITIDO_INCERTIDUMBRE',motivo:'Incertidumbre de transporte: consultar SUNAT; no reenviar.'};
  const resultado=presentarResultado(fila.estado,aCdr(fila.cdr_sunat),fila.history ?? [],fila.transport_uncertain);
  if (resultado?.origen === 'SUNAT' && fila.estado === 'RECHAZADO') return {...base,resultado:'OMITIDO_RECHAZO_DEFINITIVO',motivo:'Rechazo definitivo de SUNAT: no se reabre ni se reenvía.'};
  const ultimoError=(fila.history ?? []).find(e=>e.codigo_error && e.codigo_error!=='M1_NOTE_DESCRIPTION_COMPLETED');
  const localSinDetalle=!resultado && ultimoError?.codigo_error?.startsWith('M1_PREPARATION_');
  if (resultado?.origen === 'VALIDACION_LOCAL' || (resultado?.origen === 'PREPARACION_LOCAL' && resultado.recuperable !== true) || localSinDetalle) {
    return {...base,resultado:'OMITIDO_BLOQUEO_LOCAL',motivo:'Bloqueo local: corregir los datos o verificar la causa antes de reintentar.'};
  }
  if (!['EN_COLA','PENDIENTE','ERROR_RED','ENVIADO'].includes(fila.estado)) return {...base,resultado:'OMITIDO_ESTADO',motivo:'El estado fiscal actual no admite este reintento.'};
  return {...base,resultado:'ELEGIBLE',motivo:'Reintento mediante la compuerta individual; no fuerza envío ni firma.'};
}

function resumir(fase: ReintentoMasivoDto['fase'], documentos: DetalleReintentoMasivo[]): ReintentoMasivoDto {
  const contar=(resultado:DetalleReintentoMasivo['resultado'])=>documentos.filter(d=>d.resultado===resultado).length;
  return {fase,documentos,elegibles:contar('ELEGIBLE'),encolados:contar('ENCOLADO'),
    omitidos_incertidumbre:contar('OMITIDO_INCERTIDUMBRE'),omitidos_rechazo_definitivo:contar('OMITIDO_RECHAZO_DEFINITIVO'),
    omitidos_bloqueo_local:contar('OMITIDO_BLOQUEO_LOCAL'),en_curso:contar('EN_CURSO'),ya_en_cola:contar('YA_EN_COLA'),
    omitidos_estado:contar('OMITIDO_ESTADO'),no_confirmados:contar('NO_CONFIRMADO')};
}

interface BatchDatabase extends Pick<PrismaService, 'invoice' | '$transaction'> {}
interface BatchQueue extends Pick<QueueService, 'reenqueueInvoiceIfIdle' | 'hasLiveInvoiceJob'> {}

@Injectable()
export class InvoiceBatchRetryService {
  constructor(@Inject(PrismaService) private readonly prisma: BatchDatabase,
    @Inject(QueueService) private readonly queue: BatchQueue) {}

  async ejecutar(companyId: string, previa = false): Promise<ReintentoMasivoDto> {
    if (!companyId) throw new ForbiddenException('ISSUER_COMPANY_REQUIRED');
    const filas=await this.prisma.invoice.findMany({where:{company_id:companyId,estado:{in:[...ESTADOS]}},select:SELECT_REENVIO,orderBy:{id:'asc'}});
    if (previa) return resumir('PREVIA',filas.map(clasificarReintentoMasivo));
    if (filas.length===0) return resumir('EJECUTADA',[]);
    return this.prisma.$transaction(async tx=>{
      // No espera ocupando el pool: un segundo clic concurrente no vuelve a publicar el lote.
      const [bloqueo]=await tx.$queryRaw<Array<{adquirido:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtextextended(${`M1_BATCH_RETRY:${companyId}`},0)) AS adquirido`;
      if (!bloqueo.adquirido) return resumir('EJECUTADA',filas.map(fila=>{
        const decision=clasificarReintentoMasivo(fila);
        return decision.resultado==='ELEGIBLE' ? {...decision,resultado:'EN_CURSO' as const,motivo:'Otro reintento masivo de esta empresa está en curso; no se duplicó.'}:decision;
      }));
      return this.procesar(companyId,filas);
    },{timeout:120000});
  }

  private async procesar(companyId:string,filas:Fila[]):Promise<ReintentoMasivoDto> {
    const documentos:DetalleReintentoMasivo[]=[];
    for (const fila of filas) {
      try {
        let decision=clasificarReintentoMasivo(fila);
        if (decision.resultado !== 'ELEGIBLE') { documentos.push(decision); continue; }
        const r=await this.queue.reenqueueInvoiceIfIdle(fila.id,companyId,async()=>{
          // La política se relee bajo bloqueo. El marcador se confirma ANTES de publicar el job.
          return this.prisma.$transaction(async tx=>{
            await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${fila.id} AND company_id = ${companyId} FOR UPDATE`;
            const actual=await tx.invoice.findFirst({where:{id:fila.id,company_id:companyId},select:SELECT_REENVIO});
            if (!actual) { decision={...decision,resultado:'OMITIDO_ESTADO',motivo:'El comprobante ya no está disponible.'}; return false; }
            decision=clasificarReintentoMasivo(actual);
            if (decision.resultado !== 'ELEGIBLE') return false;
            // Incluye jobs reclamados por el worker, aunque Invoice todavía no haya cambiado.
            if (await this.queue.hasLiveInvoiceJob(fila.id)) {
              decision={...decision,resultado:'YA_EN_COLA',motivo:'Ya existe un trabajo pendiente o activo; no se duplicó.'};
              return false;
            }
            // Mismo rescate conservador que el reintento individual para registros históricos sin marcador.
            await tx.invoice.updateMany({where:{id:fila.id,company_id:companyId,transport_uncertain:null},data:{transport_uncertain:true}});
            await tx.transactionHistory.create({data:{company_id:companyId,invoice_id:fila.id,intento:1,
              estado_anterior:actual.estado,estado_nuevo:actual.estado,codigo_error:null,
              mensaje_error:`Reintento manual masivo ${decision.numero}: solicitud autorizada; no fuerza envío.`,tiempo_respuesta_ms:null}});
            return true;
          },{timeout:15000});
        },{rescatarDlq:true});
        const detalle:DetalleReintentoMasivo=r.estado==='ENCOLADO'
          ? {...decision,resultado:'ENCOLADO',motivo:'Comprobante reencolado mediante la compuerta individual.'}
          : r.estado==='YA_EN_COLA'
            ? {...decision,resultado:'YA_EN_COLA',motivo:'Ya existe un trabajo activo; no se duplicó.'}
            : decision.resultado!=='ELEGIBLE' ? decision
              : {...decision,resultado:'OMITIDO_ESTADO',motivo:'La compuerta individual no permitió publicar el reintento.'};
        documentos.push(detalle);
      } catch {
        documentos.push({...clasificarReintentoMasivo(fila),resultado:'NO_CONFIRMADO',motivo:'No se pudo confirmar el reintento. Actualice el Monitor antes de repetir.'});
      }
    }
    return resumir('EJECUTADA',documentos);
  }
}
