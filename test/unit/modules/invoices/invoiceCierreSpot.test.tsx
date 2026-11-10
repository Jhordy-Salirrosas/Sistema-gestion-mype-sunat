import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { problemaSpotMinimo, montoDetraccionPara } from '@/modules/invoices/lib/invoiceDetraccion';
import { MedioPagoDetraccionSelect } from '@/modules/invoices/components/MedioPagoDetraccionSelect';
import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
describe('6J SPOT mínimo explícito', () => {
 it('009 grava al 10% solo por encima de 700; no infiere ni mezcla categorías', () => {
  expect(montoDetraccionPara(700, '009')).toBe(0); expect(montoDetraccionPara(1180, '009')).toBe(118);
  expect(problemaSpotMinimo([{ codigoDetraccion: '009', afectacion: '10' }], '01')).toBeUndefined();
  expect(problemaSpotMinimo([{ codigoDetraccion: '009', afectacion: '10' }, { afectacion: '10' }], '01')).toContain('mixtas');
  expect(problemaSpotMinimo([{ codigoDetraccion: '009', afectacion: '10' }], '03')).toContain('solo para factura');
 });
 it('medio requiere selección, ofrece solo depósito/transferencia y nunca presume 999', () => {
  const onChange = vi.fn(); render(<MedioPagoDetraccionSelect aplica onChange={onChange} />);
  const select = screen.getByRole('combobox'); expect((select as HTMLSelectElement).value).toBe('');
  expect(screen.getAllByRole('option').map(o => (o as HTMLOptionElement).value)).toEqual(['', '001', '003']);
  fireEvent.change(select, { target: { value: '003' } }); expect(onChange).toHaveBeenCalledWith('003');
 });
 it('cuenta BN se mantiene desde configuración de empresa sin cambios en inventario', async () => {
  const guardar = vi.fn().mockResolvedValue(undefined);
  render(<InvoiceIssuerConfigForm config={{ entorno: 'MOCK' } as never} ruc="20000000001" guardar={guardar} />);
  fireEvent.change(screen.getByLabelText('Cuenta de detracciones del Banco de la Nación'), { target: { value: '00019123456' } });
  fireEvent.submit(screen.getByLabelText('Cuenta de detracciones del Banco de la Nación').closest('form')!);
  await waitFor(() => expect(guardar).toHaveBeenCalledWith({ cuenta_banco_nacion: '00019123456' }));
 });
});
