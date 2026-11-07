import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { liquidarDescuentoGlobal } from '@/modules/invoices/lib/invoiceDescuentoGlobal';
import { detraccionConDescuento } from '@/modules/invoices/lib/invoiceDetraccionGlobal';
import { InvoiceDescuentoGlobal } from '@/modules/invoices/components/InvoiceDescuentoGlobal';
import { vi } from 'vitest';
const linea = { ...itemVacio('1'), descripcion: 'Servicio', valorUnitario: 1000 };

describe('descuentos globales 02 y 03', () => {
  it.each([['02', 900, 162, 1062], ['03', 1000, 180, 1080]] as const)('calcula y serializa %s', (codigo, gravado, igv, total) => {
    const descuentoGlobal = { codigo, monto: 100 };
    expect(liquidarDescuentoGlobal([linea], descuentoGlobal)).toMatchObject({ gravado, igv, total, error: null });
    expect(borradorAPayloadEmision({ ...borradorInicial('01', '2026-11-01'), items: [linea], descuentoGlobal }).descuento_global).toEqual(descuentoGlobal);
  });
  it('rechaza montos mayores a su base y asigna la rebaja al flete sujeto', () => {
    expect(liquidarDescuentoGlobal([linea], { codigo: '02', monto: 1001 }).error).toBeTruthy();
    const flete = { ...linea, codigoDetraccion: '012' };
    const r = detraccionConDescuento([flete, { ...linea, clave: '2' }], { codigo: '02', monto: 200 });
    expect(r.monto).toBe(127.44);
  });
  it('ofrece 02 y 03, pero no anticipos 04', () => {
    const onChange = vi.fn();
    render(<InvoiceDescuentoGlobal valor={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Descuento global (Catálogo 53)'), { target: { value: '02' } });
    expect(onChange).toHaveBeenCalledWith({ codigo: '02', monto: 0 });
    expect(screen.queryByRole('option', { name: /04/ })).toBeNull();
  });
  it('muestra el aviso condicional de cuenta 74 solo para 03', () => {
    const { rerender } = render(<InvoiceDescuentoGlobal valor={{ codigo: '03', monto: 100 }} onChange={vi.fn()} />);
    expect(screen.getByText(/cuenta 74.*Podría quedar pendiente de revisión/)).toBeTruthy();
    expect(screen.getByText(/cuenta no está activa.*importes no concuerdan/)).toBeTruthy();
    rerender(<InvoiceDescuentoGlobal valor={{ codigo: '02', monto: 100 }} onChange={vi.fn()} />);
    expect(screen.queryByText(/cuenta 74/)).toBeNull();
  });
});
