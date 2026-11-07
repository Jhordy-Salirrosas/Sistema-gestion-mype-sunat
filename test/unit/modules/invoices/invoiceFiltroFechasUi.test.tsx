import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceFiltersBar } from '@/modules/invoices/components/InvoiceFiltersBar';

describe('selector de fechas', () => {
  it('comunica la fecha elegida en el control nativo', () => {
    const onChange = vi.fn();
    render(<InvoiceFiltersBar filtros={{ busqueda: '', estado: 'TODOS', desde: '', hasta: '' }} onFiltrosChange={onChange} onActualizar={() => {}} onEmitir={() => {}} />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-15' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ desde: '2026-10-15' }));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-16' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hasta: '2026-10-16' }));
    cleanup();
  });
});
