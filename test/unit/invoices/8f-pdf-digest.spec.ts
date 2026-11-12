import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
const xml='<?xml version="1.0"?><Invoice><ds:DigestValue>DIGEST-XML==</ds:DigestValue></Invoice>';
it.each([['hash-distinto',xml,'DIGEST-XML=='],['distinto','<Invoice><DigestValue>DIGEST-SIN-DECL</DigestValue></Invoice>','DIGEST-SIN-DECL'],['',xml,'DIGEST-XML=='],[undefined,xml,'DIGEST-XML=='],['respaldo',null,'respaldo'],['respaldo','s3://no-es-xml','respaldo'],['respaldo','<?xml version="1.0"?><Invoice/>',undefined]])('PDF usa el hash de XML o respaldo permitido (%s)',async(hashCpe,xml_storage_url,esperado)=>{
 const generarPng=jest.fn(async()=> 'PNG');
 const service=Object.create(InvoiceDownloadService.prototype);service.qr={generarPng};
 const fila={items:[],payload_ubl:{hashCpe},xml_storage_url,fecha_emision:new Date('2026-11-12'),customer_identity_type:'6',customer_identity_number:'20100070970',ruc_emisor:'20000000001',tipo_comprobante:'01',serie:'F001',correlativo:1,monto_total:118};
 const result=await service.datosPdf(fila);
 if(esperado){expect(generarPng).toHaveBeenCalledWith(expect.objectContaining({hashCpe:esperado}));expect(result.qrBase64).toBe('PNG');}else{expect(generarPng).not.toHaveBeenCalled();expect(result.qrBase64).toBe('');}
});

it('PDF y QR históricos conservan el RUC guardado aunque la configuración actual tenga otro pin', async () => {
  const generarPng = jest.fn(async () => 'PNG');
  const service = Object.create(InvoiceDownloadService.prototype);
  service.qr = { generarPng };
  service.issuerConfig = { resolve: jest.fn(async () => ({ ruc: '20601234567' })) };
  const fila = { items: [], payload_ubl: {}, xml_storage_url: xml, fecha_emision: new Date('2026-11-12'),
    customer_identity_type: '6', customer_identity_number: '20100070970', ruc_emisor: '20614142503',
    tipo_comprobante: '01', serie: 'F001', correlativo: 1, monto_total: 118 };
  const before = JSON.stringify(fila);
  const result = await service.datosPdf(fila);
  expect(result.rucEmisor).toBe('20614142503');
  expect(generarPng).toHaveBeenCalledWith(expect.objectContaining({ rucEmisor: '20614142503' }));
  expect(service.issuerConfig.resolve).not.toHaveBeenCalled();
  expect(JSON.stringify(fila)).toBe(before);
});
