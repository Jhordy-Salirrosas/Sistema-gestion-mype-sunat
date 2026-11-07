import { expect, it } from 'vitest';
import { buscarDetraccion, validarCronograma } from '@/modules/invoices/lib/invoiceDetraccion';

it('muestra los códigos y tasas SPOT conforme al catálogo SUNAT', () => {
  expect(buscarDetraccion('012')).toMatchObject({ descripcion: 'Intermediación laboral y tercerización', porcentaje: 0.12 });
  expect(buscarDetraccion('019')).toMatchObject({ descripcion: 'Arrendamiento de bienes', porcentaje: 0.1 });
  expect(buscarDetraccion('022')?.porcentaje).toBe(0.12);
  expect(buscarDetraccion('035')).toMatchObject({ descripcion: 'Bienes exonerados del IGV', porcentaje: 0.015 });
  expect(buscarDetraccion('039')).toMatchObject({ descripcion: 'Minerales no metálicos', porcentaje: 0.1 });
  expect(buscarDetraccion('037')?.porcentaje).toBe(0.12);
});

it('rechaza un vencimiento inexistente aunque JavaScript normalice la fecha', () => {
  expect(validarCronograma([{ monto: 100, vencimiento: '2026-02-30' }], 100, '2026-02-01').errores.length).toBeGreaterThan(0);
});

it('rechaza una cuota con fracciones de céntimo', () => {
  expect(validarCronograma([{ monto: 1.001, vencimiento: '2026-03-01' }], 1, '2026-02-01').errores.length).toBeGreaterThan(0);
});
