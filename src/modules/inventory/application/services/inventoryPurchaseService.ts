import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { PurchasesService } from '../../../purchases/application/services/purchasesService';

/**
 * Servicio puente para compatibilidad hacia atrás del módulo de inventario.
 * Delega toda la lógica transaccional al módulo autónomo PurchasesService (Fase 1).
 */
@Injectable()
export class InventoryPurchaseService extends PurchasesService {
  constructor(
    prisma: PrismaService,
    @Optional()
    accounting?: GenerateAccountingEntryUseCase,
  ) {
    super(prisma, accounting);
  }
}

