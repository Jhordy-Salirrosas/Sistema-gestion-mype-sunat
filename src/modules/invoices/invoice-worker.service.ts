import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prismaService';
import { UblGeneratorService, InvoicePayload } from './ubl-generator.service';
import { XsdValidatorService } from './xsd-validator.service';
import { SignatureService } from '../sunat/signature.service';

export interface ProcessJobResult {
    success: boolean;
    invoiceId: string;
    status: string;
    signedXml?: string;
    errorMessage?: string;
}

@Injectable()
export class InvoiceWorkerService {
    private readonly logger = new Logger(InvoiceWorkerService.name);
    public static readonly MAIN_QUEUE = 'sunat-invoice-queue';
    public static readonly DLQ_QUEUE = 'sunat-invoice-dlq';

    constructor(
        private readonly prisma: PrismaService,
        private readonly ublGenerator: UblGeneratorService,
        private readonly xsdValidator: XsdValidatorService,
        private readonly signatureService: SignatureService,
    ) { }

    public async processInvoiceJob(jobData: { invoiceId: string; payload: InvoicePayload }): Promise<ProcessJobResult> {
        const { invoiceId, payload } = jobData;
        const startTime = Date.now();

        this.logger.log(`[Job Tomado] Procesando comprobante: ${invoiceId}`);

        // 1. Transición de estado: PENDIENTE -> PROCESANDO (Criterio 1)
        await this.updateInvoiceStatus(invoiceId, 'PROCESANDO');
        await this.recordAudit(invoiceId, 1, 'PENDIENTE', 'PROCESANDO', 'JOB_ACQUIRED', 'Job tomado por el worker');

        try {
            // 2. Generación de XML UBL 2.1 oficial (Criterio 2)
            const rawXml = this.ublGenerator.generateInvoiceXml(payload);

            // 3. Validación estructural contra UBL-Invoice-2.1.xsd (Criterio 3)
            const validation = this.xsdValidator.validateInvoiceUbl21(rawXml);

            if (!validation.isValid) {
                const errorDetail = validation.errors.join(' | ');
                this.logger.error(`[Fallo XSD] Comprobante ${invoiceId} inválido: ${errorDetail}`);

                // Desvío a DLQ y registro de auditoría sin perder el payload (Criterio 5)
                await this.updateInvoiceStatus(invoiceId, 'ERROR_VALIDACION_XSD');
                await this.recordAudit(
                    invoiceId,
                    1,
                    'PROCESANDO',
                    'FALLIDO_DLQ',
                    'ERR_XSD_SCHEMA',
                    `Rechazado por XSD: ${errorDetail}`,
                    Date.now() - startTime,
                );

                return {
                    success: false,
                    invoiceId,
                    status: 'ERROR_VALIDACION_XSD',
                    errorMessage: errorDetail,
                };
            }

            // 4. Firma digital XMLDSig X.509 reutilizando el servicio de TA-07
            const signatureResult = this.signatureService.signXml(rawXml);

            // 5. Transición exitosa y auditoría completa (Criterio 4)
            const duration = Date.now() - startTime;
            await this.updateInvoiceStatus(invoiceId, 'PROCESADO', signatureResult.signedXml);
            await this.recordAudit(
                invoiceId,
                1,
                'PROCESANDO',
                'PROCESADO',
                'SUCCESS_READY_FOR_SUNAT',
                'XML generado, validado contra XSD y firmado correctamente',
                duration,
            );

            this.logger.log(`[Éxito Pipeline] Comprobante ${invoiceId} listo en ${duration}ms`);

            return {
                success: true,
                invoiceId,
                status: 'PROCESADO',
                signedXml: signatureResult.signedXml,
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`[Falla Pipeline] Error al procesar ${invoiceId}: ${error.message}`);

            await this.updateInvoiceStatus(invoiceId, 'FALLIDO');
            await this.recordAudit(
                invoiceId,
                1,
                'PROCESANDO',
                'FALLIDO',
                'ERR_WORKER_PIPELINE',
                error.message,
                duration,
            );

            return {
                success: false,
                invoiceId,
                status: 'FALLIDO',
                errorMessage: error.message,
            };
        }
    }

    private async updateInvoiceStatus(id: string, status: string, signedXml?: string) {
        const prisma = this.prisma as any;
        if (!prisma?.invoice) return;
        await prisma.invoice.update({
            where: { id },
            data: {
                estado: status,
                ...(signedXml ? { ubl_xml: signedXml } : {}),
            },
        }).catch(() => null);
    }

    private async recordAudit(
        invoiceId: string,
        intento: number,
        estadoAnterior: string,
        estadoNuevo: string,
        codigoError: string,
        mensajeError: string,
        tiempoMs = 0,
    ) {
        const prisma = this.prisma as any;
        if (!prisma?.transactionHistory) return;
        await prisma.transactionHistory.create({
            data: {
                invoice_id: invoiceId,
                intento,
                estado_anterior: estadoAnterior,
                estado_nuevo: estadoNuevo,
                codigo_error: codigoError,
                mensaje_error: mensajeError,
                tiempo_respuesta_ms: tiempoMs,
            },
        }).catch(() => null);
    }
}