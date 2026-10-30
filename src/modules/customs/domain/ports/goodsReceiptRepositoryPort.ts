import { GoodsReceiptEntity } from '../entities/goodsReceiptEntity';

export const GOODS_RECEIPT_REPOSITORY_PORT = Symbol('GOODS_RECEIPT_REPOSITORY_PORT');

export interface IGoodsReceiptRepositoryPort {
  save(receipt: GoodsReceiptEntity): Promise<GoodsReceiptEntity>;
  findById(id: string, companyId: string): Promise<GoodsReceiptEntity | null>;
  findByReceiptNumber(receiptNumber: string, companyId: string): Promise<GoodsReceiptEntity | null>;
  findByDeclarationId(declarationId: string, companyId: string): Promise<GoodsReceiptEntity[]>;
  listByCompany(
    companyId: string,
    options?: { declarationId?: string; status?: string },
  ): Promise<GoodsReceiptEntity[]>;
}

