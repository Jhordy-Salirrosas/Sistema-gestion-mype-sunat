import { harness, nota, entradaNota } from '../../fixtures/noteCreationHarness';
import { UblGeneratorService } from '../../../src/modules/invoices/ublGeneratorService';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { validarSustentoOtros, validarMotivoNota } from '../../../src/modules/invoices/application/services/noteReasonGuard';
import { devuelveUnidades } from '../../../src/modules/invoices/application/services/notePhysicalReturnPolicy';
import { SignatureService } from '../../../src/modules/sunat/signature.service';
import { fakeIssuerCertificate } from '../../fixtures/fakeIssuerCertificate';
import { ejecutarSfs } from '../../../src/modules/invoices/application/services/sunatSfsRunner';
const sustento = 'Ajuste monetario por reclamo sustentado del servicio original';
const dto = () => ({ ...nota(), codigo_motivo_nota: '10', descripcion_motivo_nota: sustento, items: [{ ...nota().items[0], precioUnitario: 59 }] });
it.each(['pantalla', 'fiscal'])('10 conserva líneas/origen/afectación/saldo por %s y no devuelve unidades', async ruta => {
  const h = harness(); const ready = await h.run(entradaNota(dto(), ruta));
  const r = traducirEmision(ready, { ruc: '20100070970', razonSocial: 'Emisor', codigoLocalAnexo: '0000' }, 1);
  expect(r.importes.total).toBe(59); expect(r.importes.igv).toBe(9);
  const xml = new UblGeneratorService().generateInvoiceXml(r.dto.payload_ubl);
  expect(xml).toContain('<cbc:ResponseCode'); expect(xml).toContain('>10</cbc:ResponseCode>');
  expect(xml).toContain(sustento); expect(xml).toContain('F001-00000001');
  expect(xml).toContain('<cac:CreditNoteLine>'); expect(devuelveUnidades('10')).toBe(false);
});
it.each([undefined, '', '  ', 'Otros conceptos'])('10 exige sustento específico: %j', descripcion => {
  expect(() => validarSustentoOtros('07', '10', descripcion)).toThrow('Describa el ajuste');
});
it.each(['origen', 'sku', 'afectacion', 'cantidad', 'saldo', 'cero'])('10 no omite la guarda de %s', async causa => {
  const h = harness(); const d = dto();
  if (causa === 'origen') h.origin.estado = 'RECHAZADO';
  if (causa === 'sku') d.items[0].codigo = 'AJENO';
  if (causa === 'afectacion') Object.assign(d.items[0], { afectacion: '20' });
  if (causa === 'cantidad') d.items[0].cantidad = 2;
  if (causa === 'saldo') d.items[0].precioUnitario = 119;
  if (causa === 'cero') d.items[0].precioUnitario = 0;
  await expect(h.run(d)).rejects.toThrow();
});
it('08 permanece deshabilitado y otros motivos no exigen el sustento nuevo', () => {
  expect(() => validarMotivoNota('07', '08')).toThrow('no está habilitado');
  expect(() => validarSustentoOtros('07', '09')).not.toThrow();
  expect(() => validarSustentoOtros('08', '10')).not.toThrow();
});
it('XML 10 firmado supera XSD/XSL oficial sin transporte', async () => {
  const ready = await harness().run(dto());
  const payload = traducirEmision(ready, { ruc: '20100070970', razonSocial: 'Emisor', codigoLocalAnexo: '0000' }, 1).dto.payload_ubl;
  const cert = fakeIssuerCertificate();
  const signer = new SignatureService({ getCertificate: () => ({ certificatePem: cert.pem, privateKeyPem: cert.privateKeyPem }) } as never);
  const xml = signer.signXml(new UblGeneratorService().generateInvoiceXml(payload)).signedXml;
  expect(await ejecutarSfs(xml, '07')).toEqual({ completado: true, errores: [] });
});
