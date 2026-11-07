import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from '@/components/ui';
import { InvoiceTabsNav, RUTA_POR_TAB, tabDesdeRuta, contarPorTab } from '@/modules/invoices/components/InvoiceTabsNav';

afterEach(cleanup);

it('muestra las tres pestañas superiores con sus conteos, sin Notas', () => {
  const onValueChange = vi.fn();
  render(<Tabs defaultValue="comprobantes" onValueChange={onValueChange}>
    <InvoiceTabsNav conteo={{ comprobantes: 12, notas: 4, bajas: 3, monitor: 19 }} />
  </Tabs>);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.queryByRole('tab', { name: /^Notas/ })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Facturas y Boletas 12' })).toBeTruthy();
  const bajas = screen.getByRole('tab', { name: 'Bajas y Resúmenes Diarios 3' });
  fireEvent.mouseDown(bajas, { button: 0, ctrlKey: false });
  expect(onValueChange).toHaveBeenCalledWith('bajas');
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Monitor Outbox y Auditoría CDR 19' }), { button: 0, ctrlKey: false });
  expect(onValueChange).toHaveBeenCalledWith('monitor');
});

it('mantiene la identificación y el conteo de la sección Notas para su ruta lateral', () => {
  expect(RUTA_POR_TAB.notas).toBe('/invoices/notas');
  expect(tabDesdeRuta('/invoices/notas')).toBe('notas');
  expect(contarPorTab([]).notas).toBe(0);
  render(<Tabs value="notas"><InvoiceTabsNav conteo={{ comprobantes: 0, notas: 0, bajas: 0, monitor: 0 }} /></Tabs>);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.queryByRole('tab', { selected: true })).toBeNull();
});
