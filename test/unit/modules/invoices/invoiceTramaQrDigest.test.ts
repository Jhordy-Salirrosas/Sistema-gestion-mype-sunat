/**
 * El digest solo cuenta si tiene contenido.
 *
 * HISTORIA DE ESTE ARCHIVO
 *
 * Primer arreglo: el QR llevaba el SHA-256 HEX de `hash_xml` en vez del digest
 * BASE64 del XML firmado. Enmascaró un segundo defecto, que se vio recién por
 * el túnel: mientras el XML viajaba, `obtenerXmlDesdeBackend` devolvía la CADENA
 * VACÍA (blob no reconocido como XML) y la trama se pintaba terminando en `||`.
 *
 * Segundo arreglo: ocultar la trama cuando no hay digest. Pero el texto del
 * `digestValue` usaba `digest ?? '...'`, y `??` NO filtra la cadena vacía: la
 * primera pintura seguía mostrando "No disponible: el XML aún no está firmado",
 * justo el mensaje que delataba que se había medido sobre otro build.
 *
 * De ahí la regla que fijan estas pruebas: `extraerDigestValue` devuelve `null`
 * (no `''`) cuando no hay digest válido, y el componente comprueba contenido,
 * no `null`.
 */
import { describe, expect, it } from 'vitest';
import { extraerDigestValue } from '@/modules/invoices/lib/invoiceDescarga';
import { generarTramaQrSunat } from '@/modules/invoices/lib/invoiceCreditAndRules';

/** Fragmento del XML firmado real de F001-00000047. */
const XML_FIRMADO = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:Signature>
    <ds:SignedInfo>
      <ds:DigestValue>ZeHAEYsi77Xs8W4s6W9PWx9eu6WsAjlLIp9mVtE998I=</ds:DigestValue>
    </ds:SignedInfo>
  </ds:Signature>
</Invoice>`;

describe('digest del XML firmado', () => {
  it('extrae el DigestValue BASE64 del XML', () => {
    expect(extraerDigestValue(XML_FIRMADO)).toBe(
      'ZeHAEYsi77Xs8W4s6W9PWx9eu6WsAjlLIp9mVtE998I=',
    );
  });

  it('acepta el XML sin prefijo de namespace', () => {
    const sinPrefijo =
      '<Signature><DigestValue>abc123=</DigestValue></Signature>';
    expect(extraerDigestValue(sinPrefijo)).toBe('abc123=');
  });

  it('devuelve null si el documento no está firmado', () => {
    expect(extraerDigestValue('<Invoice></Invoice>')).toBeNull();
    expect(extraerDigestValue(null)).toBeNull();
  });

  /*
   * EL CASO QUE SE ESCAPÓ: `obtenerXmlDesdeBackend` devuelve '' cuando el blob
   * no es un XML. Si `extraerDigestValue('')` devolviera '', el `??` del
   * componente no lo filtraría y se pintaría una trama terminada en `||`.
   */
  it('devuelve null —no cadena vacía— con un texto vacío', () => {
    expect(extraerDigestValue('')).toBeNull();
    expect(extraerDigestValue('   ')).toBeNull();
  });

  it('devuelve null cuando el DigestValue está presente pero vacío', () => {
    const vacio = '<Signature><DigestValue></DigestValue></Signature>';
    expect(extraerDigestValue(vacio)).toBeNull();
    const soloEspacios = '<Signature><DigestValue>   </DigestValue></Signature>';
    expect(extraerDigestValue(soloEspacios)).toBeNull();
  });
});

describe('trama QR con el digest real', () => {
  const digest = extraerDigestValue(XML_FIRMADO) ?? '';

  const trama = generarTramaQrSunat({
    rucEmisor: '20601234567',
    tipo: '01',
    serie: 'F001',
    correlativo: 47,
    igv: 1.8,
    total: 11.8,
    fecha: '2026-11-03',
    tipoDocCliente: '6',
    numDocCliente: '20100070970',
    hashCpe: digest,
  });

  it('tiene los 10 campos + el separador final', () => {
    expect(trama.split('|')).toHaveLength(11);
  });

  it('arranca con el RUC del emisor', () => {
    expect(trama.startsWith('20601234567|01|F001|47|')).toBe(true);
  });

  it('termina con el digest, no en vacío', () => {
    expect(trama.endsWith('|ZeHAEYsi77Xs8W4s6W9PWx9eu6WsAjlLIp9mVtE998I=|')).toBe(
      true,
    );
    expect(trama).not.toMatch(/\|\|$/);
  });

  /*
   * La trama NO se genera si no hay digest: el componente pinta el indicador.
   * Esta prueba fija el contrato —una trama sin hash es un QR inválido— y evita
   * que alguien vuelva a "rellenar" el campo.
   */
  it('una trama construida con digest vacío termina en ||', () => {
    const invalida = generarTramaQrSunat({
      rucEmisor: '20601234567',
      tipo: '01',
      serie: 'F001',
      correlativo: 47,
      igv: 1.8,
      total: 11.8,
      fecha: '2026-11-03',
      tipoDocCliente: '6',
      numDocCliente: '20100070970',
      hashCpe: '',
    });
    expect(invalida).toMatch(/\|\|$/);
    // Por eso el componente solo la pinta cuando `digest` tiene contenido.
    expect(extraerDigestValue('')).toBeNull();
  });
});
