import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateImportOrderItemDto {
  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción del producto es obligatoria.' })
  description!: string;

  @IsString()
  @IsOptional()
  hsCode?: string;

  @IsNumber()
  @Min(0.0001, { message: 'La cantidad debe ser mayor a 0.' })
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'El precio unitario FOB no puede ser negativo.' })
  unitPriceFob!: number;

  @IsString()
  @IsOptional()
  unitCode?: string;
}

export class CreateImportOrderDto {
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del proveedor del exterior es obligatorio.' })
  supplierName!: string;

  @IsString()
  @IsOptional()
  supplierCountry?: string; // Default: CN

  @IsString()
  @IsOptional()
  supplierTaxId?: string;

  @IsString()
  @IsOptional()
  supplierAddress?: string;

  @IsString()
  @IsOptional()
  supplierCondition?: string; // FABRICANTE, DISTRIBUIDOR, COMERCIANTE, BROKER

  @IsBoolean()
  @IsOptional()
  isRelated?: boolean; // Art. 24 OMC / Decisión 571 SUNAT

  @IsString()
  @IsOptional()
  supplierEmail?: string;

  @IsString()
  @IsOptional()
  supplierPhone?: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  incoterm?: string; // Default: FOB

  @IsString()
  @IsOptional()
  currencyCode?: string; // Default: USD

  @IsString()
  @IsOptional()
  issueDate?: string;

  @IsString()
  @IsOptional()
  expectedArrivalDate?: string;

  @IsString()
  @IsOptional()
  portOfOrigin?: string;

  @IsString()
  @IsOptional()
  portOfDestination?: string; // Default: CALLAO

  @IsString()
  @IsOptional()
  transportMode?: string; // Default: MARITIMO

  @IsNumber()
  @IsOptional()
  estimatedFreight?: number;

  @IsNumber()
  @IsOptional()
  estimatedInsurance?: number;

  @IsString()
  @IsOptional()
  proformaNumber?: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  documentFileName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  responsible?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un ítem en la orden de importación.' })
  @ValidateNested({ each: true })
  @Type(() => CreateImportOrderItemDto)
  items!: CreateImportOrderItemDto[];
}

export class AdvanceStageDto {
  @IsNumber()
  @Min(0)
  nextStageIndex!: number;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de la etapa es obligatorio.' })
  stageName!: string;

  @IsString()
  @IsNotEmpty({ message: 'El usuario responsable es obligatorio.' })
  userName!: string;

  @IsString()
  @IsOptional()
  evidenceNotes?: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  documentType?: string;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileHash?: string;
}

export class AddOrderDocumentDto {
  @IsNumber()
  @Min(0)
  stageIndex!: number;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de la etapa es obligatorio.' })
  stageName!: string;

  @IsString()
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio.' })
  documentType!: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de comprobante/documento es obligatorio.' })
  documentNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de archivo es obligatorio.' })
  fileName!: string;

  @IsString()
  @IsNotEmpty({ message: 'La URL de almacenamiento es obligatoria.' })
  storageUrl!: string;

  @IsString()
  @IsOptional()
  fileHash?: string;

  @IsNumber()
  @IsOptional()
  fileSizeBytes?: number;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsString()
  @IsOptional()
  uploadedBy?: string;
}

export class GenerateShipmentFromOrderDto {
  @IsString()
  @IsOptional()
  customsBrokerId?: string;

  @IsString()
  @IsOptional()
  originCountryCode?: string;

  @IsString()
  @IsOptional()
  destinationCustoms?: string; // '118' Callao, '370' Chancay

  @IsString()
  @IsOptional()
  etdDate?: string;

  @IsString()
  @IsOptional()
  etaDate?: string;
}

export interface StageRequirement {
  stageIndex: number;
  stageName: string;
  mandatoryDocType: string;
  mandatoryDocLabel: string;
  description: string;
}

export const STAGE_CHECKLIST: StageRequirement[] = [
  { stageIndex: 0, stageName: 'Solicitud', mandatoryDocType: 'SOLICITUD', mandatoryDocLabel: 'Requerimiento Interno', description: 'Requerimiento de compra o solicitud aprobada' },
  { stageIndex: 1, stageName: 'Aprobación / OC', mandatoryDocType: 'ORDEN_COMPRA', mandatoryDocLabel: 'Orden de Compra Internacional', description: 'Orden de compra oficial firmada y emitida al proveedor' },
  { stageIndex: 2, stageName: 'Proforma', mandatoryDocType: 'PROFORMA', mandatoryDocLabel: 'Factura Proforma / Commercial Invoice', description: 'Factura proforma o comercial emitida por el proveedor del exterior' },
  { stageIndex: 3, stageName: 'Embarque', mandatoryDocType: 'BL_GUIA_AEREA', mandatoryDocLabel: 'B/L (Bill of Lading) o Guía Aérea', description: 'Conocimiento de embarque marítimo o guía aérea AWB' },
  { stageIndex: 4, stageName: 'Tránsito', mandatoryDocType: 'POLIZA_SEGURO', mandatoryDocLabel: 'Póliza de Seguro / Packing List', description: 'Póliza de seguro internacional y/o lista de empaque' },
  { stageIndex: 5, stageName: 'Arribo', mandatoryDocType: 'AVISO_LLEGADA', mandatoryDocLabel: 'Aviso de Llegada / Volante', description: 'Aviso de llegada a puerto o terminal del transportista' },
  { stageIndex: 6, stageName: 'Almacén Aduanero', mandatoryDocType: 'INGRESO_ALMACEN', mandatoryDocLabel: 'Tarja / Ingreso a Depósito Temporal', description: 'Constancia de ingreso a almacén temporal / terminal' },
  { stageIndex: 7, stageName: 'DAM', mandatoryDocType: 'DAM_DUA', mandatoryDocLabel: 'Declaración Aduanera (DAM / DUA 10)', description: 'Numeración oficial de la DAM ante SUNAT' },
  { stageIndex: 8, stageName: 'Canal', mandatoryDocType: 'ASIGNACION_CANAL', mandatoryDocLabel: 'Control Concurrente SUNAT (Canal)', description: 'Asignación de canal verde, naranja o rojo' },
  { stageIndex: 9, stageName: 'Tributos', mandatoryDocType: 'LIQUIDACION_TRIBUTOS', mandatoryDocLabel: 'Constancia de Pago de Tributos (CDA)', description: 'Liquidación de cobranza y comprobante bancario' },
  { stageIndex: 10, stageName: 'Levante', mandatoryDocType: 'LEVANTE_AUTORIZADO', mandatoryDocLabel: 'Levante Autorizado SUNAT', description: 'Constancia oficial de levante autorizado de mercancías' },
  { stageIndex: 11, stageName: 'Retiro', mandatoryDocType: 'GUIA_RETIRO', mandatoryDocLabel: 'Guía de Remisión / Pase de Salida', description: 'Pase de salida de almacén y guía de remisión' },
  { stageIndex: 12, stageName: 'Recepción', mandatoryDocType: 'ACTA_RECEPCION', mandatoryDocLabel: 'Acta de Recepción de Mercancías', description: 'Conformidad física e informe de discrepancias en almacén' },
  { stageIndex: 13, stageName: 'Costeo', mandatoryDocType: 'HOJA_COSTEO', mandatoryDocLabel: 'Liquidación Landed Cost (NIC 2)', description: 'Hoja de costeo unitario final e ingreso a Kardex Op. 18' },
];
