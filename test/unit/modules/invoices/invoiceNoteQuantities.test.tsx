import { apiClient } from '@/lib/axios';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { limitesNota } from '@/modules/invoices/lib/invoiceNoteQuantities';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { QueryClient } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { afterEach,beforeEach as billingBeforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const clientes: QueryClient[] = [];
afterEach(() => { cleanup(); clientes.forEach(q => q.clear()); clientes.length = 0; vi.resetAllMocks(); });
const item = (cantidad: number) => ({ ...itemVacio(String(cantidad)), codigo: 'MAT-1', cantidad });
it('descuenta las otras filas del mismo SKU, con cantidades fraccionarias exactas', () => {
 const saldos = [{ codigo: 'MAT-1', original: 5, pendiente: 2 }];
 expect(limitesNota([item(.7), item(1.3)], saldos, '07', ['01', '02', '06'])).toEqual({ maximos: [.7, 1.3], errores: [] });
 expect(limitesNota([item(2), item(1)], saldos, '07', ['01', '02', '06']).errores).toHaveLength(2);
 expect(limitesNota([item(3)], saldos, '13', ['01', '02', '06'])).toEqual({ maximos: [5], errores: [] });
});
it('sin cantidades no inventa un máximo; SKU ajeno tiene máximo cero', () => {
 expect(limitesNota([item(1)], undefined, '07', ['01', '02', '06']).errores).toHaveLength(1);
 expect(limitesNota([item(1)], [], '07', ['01', '02', '06']).maximos).toEqual([0]);
});
it('el cliente rechaza una proyección vieja o cantidades inválidas', async () => {
 for (const cantidades_pendientes of [undefined, [{ codigo: 'X', original: 2, pendiente: -1 }]]) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 118, devuelto: 0, disponible: 118, cantidades_pendientes } });
  await expect(invoicesApi.getSaldoNota('origen')).rejects.toThrow('cantidades pendientes');
 }
});

it.each(['01', '02', '06'])('motivo total %s exige mínimo pendiente y conserva máximo', motivo => {
 const pool = [{ codigo: 'MAT-1', original: 10, pendiente: 8 }];
 const totales = ['01', '02', '06'];
 expect(limitesNota([item(4)], pool, motivo, totales).errores).toEqual([expect.stringContaining('todas las unidades pendientes')]);
 expect(limitesNota([item(3), item(5)], pool, motivo, totales).errores).toEqual([]);
 expect(limitesNota([item(9)], pool, motivo, totales).errores[0]).toContain('supera las unidades');
});
it('el mínimo incluye SKU omitidos, agrupa filas y mantiene precisión decimal', () => {
 const pool = [{ codigo: 'MAT-1', original: 1, pendiente: .3 }, { codigo: 'OTRO', original: 1, pendiente: 1 }];
 const totales = ['01'];
 expect(limitesNota([item(.1), item(.2)], pool, '01', totales).errores).toEqual([expect.stringContaining('OTRO')]);
 expect(limitesNota([item(.1), item(.2), { ...item(1), codigo: 'OTRO' }], pool, '01', totales).errores).toEqual([]);
 expect(limitesNota([item(.1)], pool, '07', totales).errores).toEqual([]);
});
it('consume la totalidad del servidor y no una lista fija de códigos del front', () => {
 const pool = [{ codigo: 'MAT-1', original: 10, pendiente: 10 }];
 expect(limitesNota([item(5)], pool, '01', []).errores).toEqual([]);
 expect(limitesNota([item(5)], pool, '13', ['13']).errores[0]).toContain('todas las unidades pendientes');
 expect(limitesNota([item(5)], pool, '01').errores[0]).toContain('consultar los motivos totales');
});
it('el contrato de saldo exige metadatos válidos, sin asumir una lista local', async () => {
 const base = { total: 118, devuelto: 0, disponible: 118, cantidades_pendientes: [] };
 for (const motivos_totales of [undefined, null, [''], [1]]) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...base, motivos_totales } });
  await expect(invoicesApi.getSaldoNota('origen')).rejects.toThrow('motivos totales');
 }
 vi.mocked(apiClient.get).mockResolvedValue({ data: { ...base, motivos_totales: ['13'] } });
 expect((await invoicesApi.getSaldoNota('origen')).motivos_totales).toEqual(['13']);
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
