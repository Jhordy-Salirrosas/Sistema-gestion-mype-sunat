import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  CreateImportQuotationDto,
  UpdateImportQuotationDto,
  AddProformaDto,
  UpdateProformaDto,
} from '../dto/importQuotationDto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

@Injectable()
export class ImportQuotationService {
  constructor(private readonly prisma: PrismaService) {}

  async listQuotations(companyId: string, query?: { status?: string; search?: string }) {
    const where: any = { company_id: companyId };
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { quotation_number: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.importQuotation.findMany({
      where,
      include: {
        proformas: {
          include: {
            supplier: true,
            items: true,
          },
          orderBy: { created_at: 'asc' },
        },
        order: {
          select: { id: true, order_number: true, status: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return {
      total: items.length,
      items: items.map((q) => this.mapQuotation(q)),
    };
  }

  async getQuotationById(companyId: string, id: string) {
    const quotation = await this.prisma.importQuotation.findFirst({
      where: { id, company_id: companyId },
      include: {
        proformas: {
          include: {
            supplier: true,
            items: true,
          },
          orderBy: { created_at: 'asc' },
        },
        order: {
          select: { id: true, order_number: true, status: true },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Cotización de importación "${id}" no encontrada.`);
    }

    return this.mapQuotation(quotation);
  }

  async createQuotation(companyId: string, dto: CreateImportQuotationDto) {
    const now = new Date();
    const year = now.getFullYear();
    const count = await this.prisma.importQuotation.count({ where: { company_id: companyId } });
    const quotationNumber = `COT-${year}-${String(count + 1).padStart(4, '0')}`;

    const created = await this.prisma.importQuotation.create({
      data: {
        company_id: companyId,
        quotation_number: quotationNumber,
        title: dto.title.trim(),
        target_incoterm: dto.targetIncoterm?.toUpperCase() || 'FOB',
        target_currency: dto.targetCurrency?.toUpperCase() || 'USD',
        notes: dto.notes?.trim() || null,
        items: (dto.items as any) || [],
        status: 'EN_NEGOCIACION',
      },
      include: {
        proformas: true,
      },
    });

    return this.mapQuotation(created);
  }

  async updateQuotation(companyId: string, id: string, dto: UpdateImportQuotationDto) {
    const existing = await this.prisma.importQuotation.findFirst({
      where: { id, company_id: companyId },
    });
    if (!existing) throw new NotFoundException('Cotización no encontrada.');

    const updated = await this.prisma.importQuotation.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.targetIncoterm ? { target_incoterm: dto.targetIncoterm.toUpperCase() } : {}),
        ...(dto.targetCurrency ? { target_currency: dto.targetCurrency.toUpperCase() } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.items !== undefined ? { items: dto.items as any } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        proformas: {
          include: { supplier: true, items: true },
        },
        order: {
          select: { id: true, order_number: true, status: true },
        },
      },
    });

    return this.mapQuotation(updated);
  }

  async addProforma(companyId: string, quotationId: string, dto: AddProformaDto) {
    const quotation = await this.prisma.importQuotation.findFirst({
      where: { id: quotationId, company_id: companyId },
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada.');
    if (quotation.status === 'ADJUDICADA') {
      throw new BadRequestException('No se pueden añadir proformas a una cotización ya adjudicada.');
    }

    // Calcular totales de los items
    let computedFob = 0;
    const itemsData = (dto.items || []).map((it) => {
      const q = r4(Number(it.quantity || 0));
      const p = r4(Number(it.unitPrice || 0));
      const itemFob = r2(q * p);
      computedFob += itemFob;
      return {
        product_id: it.productId || null,
        sku: it.sku?.trim().toUpperCase() || null,
        description: it.description.trim(),
        quantity: q,
        unit_price: p,
        total_fob: itemFob,
        unit_code: it.unitCode || 'NIU',
        hs_code: it.hsCode || null,
      };
    });

    const totalFob = dto.totalFob > 0 ? r2(Number(dto.totalFob)) : r2(computedFob);
    const freight = r2(Number(dto.estimatedFreight || 0));
    const insurance = r2(Number(dto.estimatedInsurance || 0));
    const totalCif = r2(totalFob + freight + insurance);

    const proforma = await this.prisma.importProforma.create({
      data: {
        quotation_id: quotationId,
        supplier_id: dto.supplierId || null,
        supplier_name: dto.supplierName.trim(),
        supplier_country: (dto.supplierCountry || 'CN').toUpperCase(),
        proforma_number: dto.proformaNumber.trim(),
        incoterm: (dto.incoterm || 'FOB').toUpperCase(),
        origin_port: dto.originPort?.trim() || null,
        currency_code: (dto.currencyCode || 'USD').toUpperCase(),
        total_fob: totalFob,
        estimated_freight: freight,
        estimated_insurance: insurance,
        total_cif: totalCif,
        lead_time_days: dto.leadTimeDays ?? 30,
        payment_terms: dto.paymentTerms?.trim() || null,
        validity_date: dto.validityDate ? new Date(dto.validityDate) : null,
        notes: dto.notes?.trim() || null,
        status: 'EN_EVALUACION',
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return proforma;
  }

  async updateProforma(companyId: string, quotationId: string, proformaId: string, dto: UpdateProformaDto) {
    const quotation = await this.prisma.importQuotation.findFirst({
      where: { id: quotationId, company_id: companyId },
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada.');

    const proforma = await this.prisma.importProforma.findFirst({
      where: { id: proformaId, quotation_id: quotationId },
    });
    if (!proforma) throw new NotFoundException('Proforma no encontrada.');

    return this.prisma.importProforma.update({
      where: { id: proformaId },
      data: {
        ...(dto.supplierId !== undefined ? { supplier_id: dto.supplierId } : {}),
        ...(dto.supplierName ? { supplier_name: dto.supplierName.trim() } : {}),
        ...(dto.supplierCountry ? { supplier_country: dto.supplierCountry.toUpperCase() } : {}),
        ...(dto.proformaNumber ? { proforma_number: dto.proformaNumber.trim() } : {}),
        ...(dto.incoterm ? { incoterm: dto.incoterm.toUpperCase() } : {}),
        ...(dto.originPort !== undefined ? { origin_port: dto.originPort?.trim() || null } : {}),
        ...(dto.currencyCode ? { currency_code: dto.currencyCode.toUpperCase() } : {}),
        ...(dto.totalFob !== undefined ? { total_fob: r2(dto.totalFob) } : {}),
        ...(dto.estimatedFreight !== undefined ? { estimated_freight: r2(dto.estimatedFreight) } : {}),
        ...(dto.estimatedInsurance !== undefined ? { estimated_insurance: r2(dto.estimatedInsurance) } : {}),
        ...(dto.leadTimeDays !== undefined ? { lead_time_days: dto.leadTimeDays } : {}),
        ...(dto.paymentTerms !== undefined ? { payment_terms: dto.paymentTerms?.trim() || null } : {}),
        ...(dto.validityDate ? { validity_date: new Date(dto.validityDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.rejectionReason !== undefined ? { rejection_reason: dto.rejectionReason?.trim() || null } : {}),
      },
      include: {
        supplier: true,
        items: true,
      },
    });
  }

  async deleteProforma(companyId: string, quotationId: string, proformaId: string) {
    const quotation = await this.prisma.importQuotation.findFirst({
      where: { id: quotationId, company_id: companyId },
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada.');
    if (quotation.status === 'ADJUDICADA') {
      throw new BadRequestException('No se puede eliminar una proforma de una cotización adjudicada.');
    }

    await this.prisma.importProforma.delete({ where: { id: proformaId } });
    return { success: true };
  }

  /**
   * Adjudicar proforma ganadora y generar automáticamente la Orden de Compra Internacional.
   * Las demás proformas quedan marcadas como "DESCARTADA_EN_CARTERA" para el historial de compras.
   */
  async awardProforma(companyId: string, quotationId: string, proformaId: string) {
    const quotation = await this.prisma.importQuotation.findFirst({
      where: { id: quotationId, company_id: companyId },
      include: { proformas: { include: { items: true, supplier: true } } },
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada.');
    if (quotation.status === 'ADJUDICADA') {
      throw new ConflictException('Esta cotización ya fue adjudicada previamente.');
    }

    const winner = quotation.proformas.find((p) => p.id === proformaId);
    if (!winner) {
      throw new NotFoundException(`La proforma "${proformaId}" no pertenece a esta cotización.`);
    }

    const now = new Date();
    const year = now.getFullYear();

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar la ganadora
      await tx.importProforma.update({
        where: { id: proformaId },
        data: { status: 'GANADORA' },
      });

      // 2. Marcar las no ganadoras como "DESCARTADA_EN_CARTERA"
      const nonWinners = quotation.proformas.filter((p) => p.id !== proformaId);
      for (const nw of nonWinners) {
        await tx.importProforma.update({
          where: { id: nw.id },
          data: {
            status: 'DESCARTADA_EN_CARTERA',
            rejection_reason: nw.rejection_reason || 'Opción alternativa descartada en comparativo final.',
          },
        });
      }

      // 3. Actualizar la cotización a ADJUDICADA
      await tx.importQuotation.update({
        where: { id: quotationId },
        data: {
          status: 'ADJUDICADA',
          awarded_proforma_id: proformaId,
        },
      });

      // 4. Generar correlativo de Orden de Compra Internacional
      const count = await tx.importOrder.count({ where: { company_id: companyId } });
      const orderNumber = `OC-${year}-${String(count + 1).padStart(4, '0')}`;

      // 5. Crear la Orden de Compra Internacional
      const order = await tx.importOrder.create({
        data: {
          company_id: companyId,
          order_number: orderNumber,
          supplier_id: winner.supplier_id,
          supplier_name: winner.supplier_name,
          supplier_country: winner.supplier_country,
          incoterm: winner.incoterm,
          currency_code: winner.currency_code,
          port_of_origin: winner.origin_port,
          proforma_number: winner.proforma_number,
          quotation_id: quotationId,
          issue_date: now,
          total_fob: winner.total_fob,
          estimated_freight: winner.estimated_freight,
          estimated_insurance: winner.estimated_insurance,
          total_cif: winner.total_cif,
          current_stage: 'APROBACION_OC',
          current_stage_index: 1,
          status: 'APROBADA',
          notes: `Generada automáticamente desde cotización ${quotation.quotation_number} (Proforma ${winner.proforma_number}).`,
          responsible: 'Área de Importaciones',
          items: {
            create: winner.items.map((it) => ({
              product_id: it.product_id,
              sku: it.sku,
              description: it.description,
              quantity: it.quantity,
              unit_price_fob: it.unit_price,
              total_fob: it.total_fob,
              unit_code: it.unit_code,
              hs_code: it.hs_code,
            })),
          },
          stages: {
            create: {
              stage_index: 1,
              stage_name: 'Aprobación de Orden de Compra',
              status: 'COMPLETADO',
              user_name: 'Sistema / Importaciones',
              evidence_notes: `Orden generada por adjudicación de proforma ${winner.proforma_number}.`,
            },
          },
        },
      });

      return {
        quotationId,
        awardedProformaId: proformaId,
        generatedOrder: {
          id: order.id,
          orderNumber: order.order_number,
          totalFob: Number(order.total_fob),
          supplierName: order.supplier_name,
        },
      };
    });
  }

  private mapQuotation(q: any) {
    return {
      id: q.id,
      companyId: q.company_id,
      quotationNumber: q.quotation_number,
      title: q.title,
      targetIncoterm: q.target_incoterm,
      targetCurrency: q.target_currency,
      status: q.status,
      awardedProformaId: q.awarded_proforma_id,
      notes: q.notes,
      items: (q.items as any[]) || [],
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      proformasCount: q.proformas?.length ?? 0,
      order: q.order ? { id: q.order.id, orderNumber: q.order.order_number, status: q.order.status } : null,
      proformas: (q.proformas || []).map((p: any) => ({
        id: p.id,
        supplierId: p.supplier_id,
        supplierName: p.supplier_name,
        supplierCountry: p.supplier_country,
        supplierContact: p.supplier?.contact_name || null,
        supplierEmail: p.supplier?.email || null,
        supplierPhone: p.supplier?.phone || null,
        proformaNumber: p.proforma_number,
        incoterm: p.incoterm,
        originPort: p.origin_port,
        currencyCode: p.currency_code,
        totalFob: Number(p.total_fob),
        estimatedFreight: Number(p.estimated_freight || 0),
        estimatedInsurance: Number(p.estimated_insurance || 0),
        totalCif: Number(p.total_cif || 0),
        leadTimeDays: p.lead_time_days,
        paymentTerms: p.payment_terms,
        validityDate: p.validity_date,
        status: p.status,
        rejectionReason: p.rejection_reason,
        notes: p.notes,
        createdAt: p.created_at,
        items: (p.items || []).map((it: any) => ({
          id: it.id,
          productId: it.product_id,
          sku: it.sku,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalFob: Number(it.total_fob),
          unitCode: it.unit_code,
          hsCode: it.hs_code,
        })),
      })),
    };
  }
}
