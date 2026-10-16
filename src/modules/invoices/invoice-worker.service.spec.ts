import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceWorkerService } from './invoice-worker.service';
import { UblGeneratorService, InvoicePayload } from './ubl-generator.service';
import { XsdValidatorService } from './xsd-validator.service';
import { SignatureService } from '../sunat/signature.service';
import { PrismaService } from '../../database/prismaService';

describe('InvoiceWorkerService - TA-11 Pipeline Worker', () => {
    let worker: InvoiceWorkerService;
    let prismaMock: any;
    let signatureServiceMock: any;

    const validPayload: InvoicePayload = {
        rucEmisor: '20601234567',
        razonSocialEmisor: 'MYPE CONFECCIONES SAC',
        tipoComprobante: '01',
        serie: 'F001',
        numero: 42,
        fechaEmision: '2026-10-15',
        tipoMoneda: 'PEN',
        cliente: {
            tipoDocumento: '6',
            numeroDocumento: '20100070970',
            razonSocial: 'SUPERMERCADOS PERUANOS S.A.',
        },
        montoGravado: 100.0,
        montoIgv: 18.0,
        montoTotal: 118.0,
    };

    beforeEach(async () => {
        prismaMock = {
            invoice: { update: jest.fn().mockResolvedValue({}) },
            transactionHistory: { create: jest.fn().mockResolvedValue({}) },
        };

        signatureServiceMock = {
            signXml: jest.fn().mockImplementation((xml: string) => ({
                signedXml: xml.replace('</Invoice>', '  <ds:Signature>mock-signature</ds:Signature>\n</Invoice>'),
                digestValue: 'mock-digest',
                signatureValue: 'mock-sig',
                signatureId: 'Signature-1',
            })),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InvoiceWorkerService,
                UblGeneratorService,
                XsdValidatorService,
                { provide: SignatureService, useValue: signatureServiceMock },
                { provide: PrismaService, useValue: prismaMock },
            ],
        }).compile();

        worker = module.get<InvoiceWorkerService>(InvoiceWorkerService);
    });

    it('Criterio 1, 2 y 4: Flujo completo exitoso (PENDIENTE -> PROCESANDO -> PROCESADO con auditoría y UBL firmado)', async () => {
        const result = await worker.processInvoiceJob({
            invoiceId: 'inv-uuid-001',
            payload: validPayload,
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('PROCESADO');
        expect(result.signedXml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
        expect(result.signedXml).toContain('ds:Signature');

        // Verifica que se actualizaron los estados
        expect(prismaMock.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'inv-uuid-001' },
                data: expect.objectContaining({ estado: 'PROCESANDO' }),
            }),
        );

        // Verifica las transiciones en TransactionHistory
        expect(prismaMock.transactionHistory.create).toHaveBeenCalledTimes(2);
        expect(prismaMock.transactionHistory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    invoice_id: 'inv-uuid-001',
                    estado_anterior: 'PENDIENTE',
                    estado_nuevo: 'PROCESANDO',
                }),
            }),
        );
    });

    it('Criterio 3 y 5: Debe rechazar y mandar a DLQ si falta un nodo obligatorio en UBL 2.1 (ej. sin cliente)', async () => {
        const invalidPayload = { ...validPayload, cliente: null as any };

        const result = await worker.processInvoiceJob({
            invoiceId: 'inv-uuid-bad-002',
            payload: invalidPayload,
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('ERROR_VALIDACION_XSD');
        expect(prismaMock.transactionHistory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    invoice_id: 'inv-uuid-bad-002',
                    estado_nuevo: 'FALLIDO_DLQ',
                }),
            }),
        );
    });

    it('Criterio 3: Validador XSD detecta nodo obligatorio faltante o namespace erróneo', async () => {
        const validator = new XsdValidatorService();
        const badXml = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>F001-1</cbc:ID></Invoice>`;

        const check = validator.validateInvoiceUbl21(badXml);
        expect(check.isValid).toBe(false);
        expect(check.errors.some((e) => e.includes('cbc:UBLVersionID'))).toBe(true);
    });
});