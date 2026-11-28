import { mensajeErrorEmision } from '@/modules/invoices/lib/invoiceIdempotency';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { QueryClient } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { afterEach,beforeEach as billingBeforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const qs: QueryClient[]=[];
afterEach(()=>{cleanup();qs.forEach(q=>q.clear());qs.length=0;vi.resetAllMocks();});
it('400 conserva detail/message del back y evita el texto técnico de Axios',()=>{
 for(const data of [{detail:'NOTA_DEVOLUCION_TOTAL_INCOMPLETA: faltan unidades'},{message:'NOTA_DEVOLUCION_TOTAL_INCOMPLETA: faltan unidades'}]) {
  const error=Object.assign(new Error('Request failed with status code 400'),{response:{status:400,data}});
  expect(mensajeErrorEmision(error)).toContain('NOTA_DEVOLUCION_TOTAL_INCOMPLETA');
  expect(mensajeErrorEmision(error)).not.toContain('Request failed');
 }
});
it('el texto de reutilización de clave solo corresponde al conflicto concreto de idempotencia',()=>{
 for(const data of [{detail:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY'},{code:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY'}]) {
  expect(mensajeErrorEmision({response:{status:409,data}})).toContain('la clave de este intento ya se usó');
 }
});
it('otros 409 conservan su causa; un 409 sin detalle no afirma reutilización de clave',()=>{
 expect(mensajeErrorEmision({response:{status:409,data:{detail:'NOTA_EXCEDE_CANTIDAD: CEM-001'}}})).toBe('NOTA_EXCEDE_CANTIDAD: CEM-001');
 expect(mensajeErrorEmision({response:{status:409}})).toContain('Conflicto de emisión (409)');
 expect(mensajeErrorEmision({response:{status:409}})).not.toContain('clave');
 expect(mensajeErrorEmision(new Error('Conexión interrumpida'))).toBe('Conexión interrumpida');
 expect(mensajeErrorEmision(null)).not.toBe('Error desconocido');
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
