import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { useInvoiceFiltros } from '@/modules/invoices/lib/useInvoiceFiltros';
import { useAuthStore } from '@/stores/authStore';

const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-10-15', base: 100, estado: 'ACEPTADO' });
afterEach(() => { cleanup(); sessionStorage.clear(); useAuthStore.setState({ activeCompany: null }); });
function Filtros() {
  const [filtros, setFiltros] = useInvoiceFiltros();
  return <><input aria-label="Desde" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} /><input aria-label="Hasta" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} /></>;
}
describe('detalles de bandeja', () => {
  it('recupera las fechas tras desmontar y separa empresas', () => {
    useAuthStore.setState({ activeCompany: { tenantId: 'a', ruc: '1', razonSocial: 'A' } });
    const vista = render(<Filtros />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    vista.unmount();
    render(<Filtros />);
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('2026-10-01');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-10-31');
    cleanup();
    useAuthStore.setState({ activeCompany: { tenantId: 'b', ruc: '2', razonSocial: 'B' } });
    render(<Filtros />);
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
  });
  it('abre XML al pulsar la fila o Enter, sin interferir con CDR ni PDF', () => {
    const xml = vi.fn(), cdr = vi.fn(), pdf = vi.fn();
    render(<InvoiceTable comprobantes={[factura]} onVerXml={xml} onVerCdr={cdr} onDescargarPdf={pdf} onReintentarCdr={vi.fn()} />);
    const row = screen.getByLabelText('Ver detalle XML de F001-00000056');
    fireEvent.click(row); fireEvent.keyDown(row, { key: 'Enter' });
    expect(xml).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Ver CDR de F001-00000056' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF de F001-00000056' }));
    expect(cdr).toHaveBeenCalledTimes(1); expect(pdf).toHaveBeenCalledTimes(1); expect(xml).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Ver XML de F001-00000056' }));
    expect(xml).toHaveBeenCalledTimes(3);
  });
});
