import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../database/prismaService';
import {
  CreateImportOrderDto,
  AdvanceStageDto,
  AddOrderDocumentDto,
  GenerateShipmentFromOrderDto,
  STAGE_CHECKLIST,
} from '../dto/importOrderDto';

const STAGE_NAMES = [
  'Solicitud',
  'Aprobación / OC',
  'Proforma',
  'Embarque',
  'Tránsito',
  'Arribo',
  'Almacén Aduanero',
  'DAM',
  'Canal',
  'Tributos',
  'Levante',
  'Retiro',
  'Recepción',
  'Costeo',
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

@Injectable()
export class ImportOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(companyId: string, query?: { status?: string; search?: string }) {
    const where: any = { company_id: companyId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      where.OR = [
        { order_number: { contains: query.search, mode: 'insensitive' } },
        { supplier_name: { contains: query.search, mode: 'insensitive' } },
        { proforma_number: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orders = await this.prisma.importOrder.findMany({
      where,
      include: {
        items: true,
        stages: {
          orderBy: { stage_index: 'asc' },
        },
        documents: {
          orderBy: { stage_index: 'asc' },
        },
        shipment: {
          select: { id: true, shipment_number: true, status: true },
        },
        declarations: {
          select: { id: true, dua_number: true, channel: true, status: true },
        },
        goods_receipts: {
          select: { id: true, receipt_number: true, status: true },
        },
      },
      orderBy: { issue_date: 'desc' },
      take: 100,
    });

    return {
      total: orders.length,
      items: orders.map((o) => this.mapOrderResponse(o)),
    };
  }

  async getOrderById(companyId: string, id: string) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id, company_id: companyId },
      include: {
        items: true,
        stages: {
          orderBy: { stage_index: 'asc' },
        },
        documents: {
          orderBy: { stage_index: 'asc' },
        },
        supplier: true,
        shipment: {
          include: {
            customs_broker: true,
            declarations: true,
          },
        },
        declarations: true,
        goods_receipts: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${id}" no encontrada.`);
    }

    return this.mapOrderResponse(order);
  }

  async createOrder(companyId: string, dto: CreateImportOrderDto) {
    const now = new Date();
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : now;
    const year = issueDate.getFullYear();

    // Generar correlativo de orden de importación si no se proporciona
    let orderNumber = (dto.orderNumber ?? '').trim().toUpperCase();
    if (!orderNumber) {
      const count = await this.prisma.importOrder.count({ where: { company_id: companyId } });
      orderNumber = `OC-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const existing = await this.prisma.importOrder.findFirst({
      where: { company_id: companyId, order_number: orderNumber },
    });
    if (existing) {
      throw new ConflictException(`Ya existe la orden de importación "${orderNumber}".`);
    }

    // Calcular valores monetarios FOB y CIF estimado
    let totalFob = 0;
    const itemsData = dto.items.map((it) => {
      const lineFob = r2(it.quantity * it.unitPriceFob);
      totalFob += lineFob;
      return {
        product_code: it.productCode?.trim().toUpperCase(),
        description: it.description.trim(),
        hs_code: it.hsCode?.trim(),
        quantity: it.quantity,
        unit_price_fob: r4(it.unitPriceFob),
        total_fob: lineFob,
        unit_code: it.unitCode ?? 'NIU',
      };
    });

    const freight = r2(dto.estimatedFreight ?? 0);
    const insurance = r2(dto.estimatedInsurance ?? 0);
    const totalCif = r2(totalFob + freight + insurance);

    const initialStageIndex = 1; // Aprobación / OC
    const initialStageName = STAGE_NAMES[initialStageIndex];

    const order = await this.prisma.importOrder.create({
      data: {
        company_id: companyId,
        order_number: orderNumber,
        supplier_name: dto.supplierName.trim(),
        supplier_country: (dto.supplierCountry ?? 'CN').trim().toUpperCase(),
        supplier_tax_id: dto.supplierTaxId?.trim(),
        supplier_address: dto.supplierAddress?.trim(),
        supplier_condition: dto.supplierCondition?.trim() || 'FABRICANTE',
        is_related: Boolean(dto.isRelated),
        supplier_email: dto.supplierEmail?.trim(),
        supplier_phone: dto.supplierPhone?.trim(),
        supplier_id: dto.supplierId,
        incoterm: (dto.incoterm ?? 'FOB').trim().toUpperCase(),
        currency_code: (dto.currencyCode ?? 'USD').trim().toUpperCase(),
        issue_date: issueDate,
        expected_arrival_date: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate) : undefined,
        port_of_origin: dto.portOfOrigin?.trim(),
        port_of_destination: dto.portOfDestination?.trim() ?? 'CALLAO',
        transport_mode: dto.transportMode?.trim().toUpperCase() ?? 'MARITIMO',
        total_fob: r2(totalFob),
        estimated_freight: freight,
        estimated_insurance: insurance,
        total_cif: totalCif,
        current_stage: initialStageName,
        current_stage_index: initialStageIndex,
        status: 'APROBADA',
        proforma_number: dto.proformaNumber?.trim(),
        notes: dto.notes,
        responsible: dto.responsible,
        items: {
          create: itemsData,
        },
        stages: {
          create: [
            {
              stage_index: 0,
              stage_name: 'Solicitud',
              status: 'COMPLETADO',
              user_name: dto.responsible ?? 'Operador Comercio Exterior',
              evidence_notes: 'Solicitud aprobada y generada.',
            },
            {
              stage_index: 1,
              stage_name: initialStageName,
              status: 'COMPLETADO',
              user_name: dto.responsible ?? 'Operador Comercio Exterior',
              evidence_notes: `Orden de compra emitida a ${dto.supplierName}.`,
            },
          ],
        },
      },
      include: {
        items: true,
        stages: true,
        documents: true,
      },
    });

    if (dto.documentUrl) {
      const docName = dto.documentFileName || `Proforma_${dto.proformaNumber || orderNumber}.pdf`;
      await this.prisma.importOrderDocument.create({
        data: {
          order_id: order.id,
          stage_index: 1,
          stage_name: initialStageName,
          document_type: 'PROFORMA',
          document_number: dto.proformaNumber || orderNumber,
          storage_url: dto.documentUrl,
          file_name: docName,
          file_hash: crypto.createHash('sha256').update(`${order.id}-${dto.documentUrl}-${Date.now()}`).digest('hex'),
          uploaded_by: dto.responsible ?? 'Operador Comercio Exterior',
        },
      });
    }

    return this.mapOrderResponse(order);
  }

  async addDocument(companyId: string, orderId: string, dto: AddOrderDocumentDto) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id: orderId, company_id: companyId },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${orderId}" no encontrada.`);
    }

    const fileHash =
      dto.fileHash ||
      crypto.createHash('sha256').update(`${orderId}-${dto.fileName}-${Date.now()}`).digest('hex');

    const document = await this.prisma.importOrderDocument.create({
      data: {
        order_id: order.id,
        stage_index: dto.stageIndex,
        stage_name: dto.stageName,
        document_type: dto.documentType.trim().toUpperCase(),
        document_number: dto.documentNumber.trim(),
        file_name: dto.fileName.trim(),
        storage_url: dto.storageUrl.trim(),
        file_hash: fileHash,
        file_size_bytes: dto.fileSizeBytes ?? 1024,
        mime_type: dto.mimeType ?? 'application/pdf',
        is_mandatory: dto.isMandatory ?? true,
        is_verified: true,
        uploaded_by: dto.uploadedBy ?? 'Operador Comercio Exterior',
      },
    });

    // Si la orden ya tiene un expediente aduanero vinculado, replicar en customs_documents
    if (order.shipment_id) {
      await this.prisma.customsDocument.create({
        data: {
          shipment_id: order.shipment_id,
          document_type: dto.documentType.slice(0, 3).toUpperCase(),
          document_number: dto.documentNumber,
          issue_date: new Date(),
          issuer_name: dto.uploadedBy ?? order.supplier_name,
          storage_url: dto.storageUrl,
          is_validated: true,
        },
      });

      await this.prisma.customsEvent.create({
        data: {
          shipment_id: order.shipment_id,
          event_type: 'DOCUMENTO_ADJUNTO',
          event_timestamp: new Date(),
          registered_by: dto.uploadedBy ?? 'USUARIO',
          reference_code: dto.documentNumber,
          event_value: `Checklist [${dto.stageName}]: ${dto.documentType} - ${dto.fileName}`,
        },
      });
    }

    return {
      id: document.id,
      orderId: document.order_id,
      stageIndex: document.stage_index,
      stageName: document.stage_name,
      documentType: document.document_type,
      documentNumber: document.document_number,
      fileName: document.file_name,
      storageUrl: document.storage_url,
      fileHash: document.file_hash,
      fileSizeBytes: document.file_size_bytes,
      mimeType: document.mime_type,
      isMandatory: document.is_mandatory,
      isVerified: document.is_verified,
      uploadedBy: document.uploaded_by,
      createdAt: document.created_at,
    };
  }

  async listDocuments(companyId: string, orderId: string) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id: orderId, company_id: companyId },
      include: {
        documents: {
          orderBy: { stage_index: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${orderId}" no encontrada.`);
    }

    return order.documents.map((d) => ({
      id: d.id,
      orderId: d.order_id,
      stageIndex: d.stage_index,
      stageName: d.stage_name,
      documentType: d.document_type,
      documentNumber: d.document_number,
      fileName: d.file_name,
      storageUrl: d.storage_url,
      fileHash: d.file_hash,
      fileSizeBytes: d.file_size_bytes,
      mimeType: d.mime_type,
      isMandatory: d.is_mandatory,
      isVerified: d.is_verified,
      uploadedBy: d.uploaded_by,
      createdAt: d.created_at,
    }));
  }

  async getChecklist(companyId: string, orderId: string) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id: orderId, company_id: companyId },
      include: {
        documents: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${orderId}" no encontrada.`);
    }

    return STAGE_CHECKLIST.map((req) => {
      const attached = order.documents.filter((d) => d.stage_index === req.stageIndex);
      const isCompleted = attached.length > 0;
      return {
        stageIndex: req.stageIndex,
        stageName: req.stageName,
        mandatoryDocType: req.mandatoryDocType,
        mandatoryDocLabel: req.mandatoryDocLabel,
        description: req.description,
        isCompleted,
        isCurrent: order.current_stage_index === req.stageIndex,
        documents: attached.map((d) => ({
          id: d.id,
          documentType: d.document_type,
          documentNumber: d.document_number,
          fileName: d.file_name,
          storageUrl: d.storage_url,
          fileHash: d.file_hash,
          isVerified: d.is_verified,
          createdAt: d.created_at,
        })),
      };
    });
  }

  async advanceStage(companyId: string, id: string, dto: AdvanceStageDto) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id, company_id: companyId },
      include: {
        documents: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${id}" no encontrada.`);
    }

    if (dto.nextStageIndex < 0 || dto.nextStageIndex >= STAGE_NAMES.length) {
      throw new BadRequestException(`Índice de etapa inválido (${dto.nextStageIndex}).`);
    }

    const stageName = STAGE_NAMES[dto.nextStageIndex] || dto.stageName;

    // Validación de documentos de checklist por etapa:
    // Si se pasa a una etapa superior, verificar si la etapa que se deja tiene documento obligatorio
    // O si se adjunta documento en esta misma llamada
    if (dto.documentUrl) {
      const docType = dto.documentType || (STAGE_CHECKLIST[order.current_stage_index]?.mandatoryDocType ?? 'DOCUMENTO');
      const docNum = dto.documentNumber || `DOC-${order.order_number}-${dto.nextStageIndex}`;
      const fName = dto.fileName || `${stageName.replace(/\s+/g, '_')}_document.pdf`;
      const hash =
        dto.fileHash ||
        crypto.createHash('sha256').update(`${order.id}-${fName}-${Date.now()}`).digest('hex');

      await this.prisma.importOrderDocument.create({
        data: {
          order_id: order.id,
          stage_index: order.current_stage_index,
          stage_name: order.current_stage,
          document_type: docType,
          document_number: docNum,
          file_name: fName,
          storage_url: dto.documentUrl,
          file_hash: hash,
          file_size_bytes: 2048,
          mime_type: 'application/pdf',
          is_mandatory: true,
          is_verified: true,
          uploaded_by: dto.userName,
        },
      });
    }

    // Actualizar estado general según la etapa alcanzada
    let nextStatus: any = order.status;
    if (dto.nextStageIndex >= 3 && dto.nextStageIndex <= 4) {
      nextStatus = 'EN_TRANSITO';
    } else if (dto.nextStageIndex === 5) {
      nextStatus = 'ARRIBADA';
    } else if (dto.nextStageIndex >= 6 && dto.nextStageIndex <= 9) {
      nextStatus = 'EN_DESPACHO';
    } else if (dto.nextStageIndex >= 10 && dto.nextStageIndex <= 11) {
      nextStatus = 'CON_LEVANTE';
    } else if (dto.nextStageIndex === 12) {
      nextStatus = 'RECEPCIONADA';
    } else if (dto.nextStageIndex === 13) {
      nextStatus = 'COSTEADA';
    }

    // Si se entra en etapa Embarque (3) o superior y aún no hay expediente aduanero,
    // generar automáticamente el expediente aduanero de importación
    let shipmentId = order.shipment_id;
    if (dto.nextStageIndex >= 3 && !shipmentId) {
      const year = new Date().getFullYear();
      const count = await this.prisma.customsShipment.count({ where: { company_id: companyId } });
      const shipmentNumber = `EXP-${year}-${String(count + 1).padStart(4, '0')}`;

      const createdShipment = await this.prisma.customsShipment.create({
        data: {
          company_id: companyId,
          shipment_number: shipmentNumber,
          order_reference: order.order_number,
          supplier_id: order.supplier_id,
          incoterm: order.incoterm,
          currency_code: order.currency_code,
          transport_mode: order.transport_mode,
          origin_country_code: order.supplier_country || 'CN',
          destination_customs: '118',
          eta_date: order.expected_arrival_date,
          status: dto.nextStageIndex >= 10 ? 'CON_LEVANTE' : 'EN_TRANSITO',
        },
      });

      shipmentId = createdShipment.id;

      await this.prisma.customsEvent.create({
        data: {
          shipment_id: createdShipment.id,
          event_type: 'EXPEDIENTE_GENERADO',
          event_timestamp: new Date(),
          registered_by: dto.userName ?? 'Operador Comercio Exterior',
          reference_code: order.order_number,
          event_value: `Generado automáticamente desde la Orden de Importación ${order.order_number}`,
        },
      });
    }

    await this.prisma.importOrderStageHistory.create({
      data: {
        order_id: order.id,
        stage_index: dto.nextStageIndex,
        stage_name: stageName,
        status: 'COMPLETADO',
        user_name: dto.userName ?? 'Operador Comercio Exterior',
        evidence_notes: dto.evidenceNotes,
        document_url: dto.documentUrl,
      },
    });

    const updated = await this.prisma.importOrder.update({
      where: { id: order.id },
      data: {
        current_stage: stageName,
        current_stage_index: dto.nextStageIndex,
        status: nextStatus,
        shipment_id: shipmentId,
      },
      include: {
        items: true,
        stages: {
          orderBy: { stage_index: 'asc' },
        },
        documents: {
          orderBy: { stage_index: 'asc' },
        },
        shipment: true,
      },
    });

    return this.mapOrderResponse(updated);
  }

  async generateShipment(companyId: string, orderId: string, dto?: GenerateShipmentFromOrderDto) {
    const order = await this.prisma.importOrder.findFirst({
      where: { id: orderId, company_id: companyId },
      include: {
        shipment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Orden de importación con ID "${orderId}" no encontrada.`);
    }

    if (order.shipment_id && order.shipment) {
      return order.shipment;
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.customsShipment.count({ where: { company_id: companyId } });
    const shipmentNumber = `EXP-${year}-${String(count + 1).padStart(4, '0')}`;

    const shipment = await this.prisma.customsShipment.create({
      data: {
        company_id: companyId,
        shipment_number: shipmentNumber,
        order_reference: order.order_number,
        supplier_id: order.supplier_id,
        customs_broker_id: dto?.customsBrokerId,
        incoterm: order.incoterm,
        currency_code: order.currency_code,
        transport_mode: order.transport_mode,
        origin_country_code: dto?.originCountryCode || order.supplier_country || 'CN',
        destination_customs: dto?.destinationCustoms || '118',
        etd_date: dto?.etdDate ? new Date(dto.etdDate) : undefined,
        eta_date: dto?.etaDate ? new Date(dto.etaDate) : order.expected_arrival_date,
        status: order.current_stage_index >= 10 ? 'CON_LEVANTE' : 'EN_TRANSITO',
      },
    });

    await this.prisma.importOrder.update({
      where: { id: order.id },
      data: { shipment_id: shipment.id },
    });

    await this.prisma.customsEvent.create({
      data: {
        shipment_id: shipment.id,
        event_type: 'EXPEDIENTE_GENERADO',
        event_timestamp: new Date(),
        registered_by: 'USUARIO',
        reference_code: order.order_number,
        event_value: `Expediente generado para Orden ${order.order_number}`,
      },
    });

    return shipment;
  }

  private mapOrderResponse(order: any) {
    return {
      id: order.id,
      orderNumber: order.order_number,
      supplierName: order.supplier_name,
      supplierCountry: order.supplier_country,
      supplierTaxId: order.supplier_tax_id,
      supplierAddress: order.supplier_address,
      supplierCondition: order.supplier_condition || 'FABRICANTE',
      isRelated: Boolean(order.is_related),
      supplierEmail: order.supplier_email,
      supplierPhone: order.supplier_phone,
      supplierId: order.supplier_id,
      incoterm: order.incoterm,
      currencyCode: order.currency_code,
      issueDate: order.issue_date,
      expectedArrivalDate: order.expected_arrival_date,
      portOfOrigin: order.port_of_origin,
      portOfDestination: order.port_of_destination,
      transportMode: order.transport_mode,
      totalFob: Number(order.total_fob),
      estimatedFreight: Number(order.estimated_freight ?? 0),
      estimatedInsurance: Number(order.estimated_insurance ?? 0),
      totalCif: Number(order.total_cif ?? 0),
      currentStage: order.current_stage,
      currentStageIndex: order.current_stage_index,
      status: order.status,
      proformaNumber: order.proforma_number,
      notes: order.notes,
      responsible: order.responsible,
      shipment: order.shipment,
      declarations: order.declarations || [],
      goodsReceipts: order.goods_receipts || [],
      items: (order.items || []).map((it: any) => ({
        id: it.id,
        productCode: it.product_code,
        description: it.description,
        hsCode: it.hs_code,
        quantity: Number(it.quantity),
        unitPriceFob: Number(it.unit_price_fob),
        totalFob: Number(it.total_fob),
        unitCode: it.unit_code,
      })),
      stages: (order.stages || []).map((st: any) => ({
        id: st.id,
        stageIndex: st.stage_index,
        stageName: st.stage_name,
        status: st.status,
        transitionDate: st.transition_date,
        userName: st.user_name,
        evidenceNotes: st.evidence_notes,
        documentUrl: st.document_url,
      })),
      documents: (order.documents || []).map((doc: any) => ({
        id: doc.id,
        orderId: doc.order_id,
        stageIndex: doc.stage_index,
        stageName: doc.stage_name,
        documentType: doc.document_type,
        documentNumber: doc.document_number,
        fileName: doc.file_name,
        storageUrl: doc.storage_url,
        fileHash: doc.file_hash,
        fileSizeBytes: doc.file_size_bytes,
        mimeType: doc.mime_type,
        isMandatory: doc.is_mandatory,
        isVerified: doc.is_verified,
        uploadedBy: doc.uploaded_by,
        createdAt: doc.created_at,
      })),
    };
  }
}
