import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
import { cleanup,render,screen } from '@testing-library/react';
import { expect,it,vi } from 'vitest';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []), getInvoiceById: vi.fn(async()=>({lineasOrigen:[{codigo:'SERV',descripcion:'Servicio',unidad:'NIU',cantidad:1,valor_unitario:2000,precio_unitario:2360,afectacion:'10'}]})), getSaldoNota: vi.fn(async () => ({ total: 1770, devuelto: 100.01, disponible: 1669.99, motivos_totales: ['01', '02', '06'], cantidades_pendientes: [{codigo:'SERV',original:1,pendiente:1}] })), emitirComprobante: vi.fn() } }));


it('muestra la sección del certificado digital (archivo, estado y vencimiento) visible y directa en Configuración', () => {
  render(
    <InvoiceIssuerConfigForm
      ruc="20100070970"
      guardar={vi.fn()}
      config={{
        entorno: 'BETA',
        perfil_comercial: 'MAYORISTA',
        cert_password_configurada: true,
        certificado: {
          archivo: 'certificado-20100070970.p12 (custodia empresa)',
          configurado: true,
          estado: 'VIGENTE',
          vence_el: '2027-05-15',
          dias_restantes: 189,
          origen: 'company',
        },
      }}
    />,
  );
  const seccion = screen.getByTestId('seccion-certificado-digital');
  expect(seccion.textContent).toContain('Certificado Digital (.PFX / .P12)');
  expect(seccion.textContent).toContain('certificado-20100070970.p12 (custodia empresa)');
  expect(seccion.textContent).toContain('Vigente');
  expect(seccion.textContent).toContain('2027-05-15 (189 días restantes)');
  cleanup();
});
