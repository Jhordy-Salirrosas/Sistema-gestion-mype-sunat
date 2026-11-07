import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { SireHealthHistoryCharts } from '@/modules/sire/components/SireHealthHistoryCharts';

afterEach(cleanup);

describe('SireHealthHistoryCharts', () => {
  it('renders the historical retries and availability series', () => {
    render(
      <SireHealthHistoryCharts
        history={[
          { timestamp: '10:00', retries: 1, availabilityPercent: 99, observedCalls: 1, successfulCalls: 1, failedCalls: 0 },
          { timestamp: '10:05', retries: 2, availabilityPercent: 97, observedCalls: 1, successfulCalls: 1, failedCalls: 0 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Gráfica histórica de reintentos' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gráfica histórica de disponibilidad' })).toBeInTheDocument();
  });

  it('shows an explicit empty state and responsive chart grid', () => {
    render(<SireHealthHistoryCharts history={[]} />);
    expect(screen.getAllByText(/Sin historial disponible/)).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Gráficas históricas de SIRE' }))
      .toHaveClass('grid-cols-1', 'xl:grid-cols-2');
  });

  it('labels null availability as no calls observed instead of plotting zero', () => {
    render(
      <SireHealthHistoryCharts
        history={[{ timestamp: '10:00', retries: 0, availabilityPercent: null, observedCalls: 0, successfulCalls: 0, failedCalls: 0 }]}
      />,
    );
    expect(screen.getByText('10:00: Sin llamadas observadas')).toBeInTheDocument();
    expect(screen.getByText('Sin llamadas observadas en este rango.')).toBeInTheDocument();
  });
});
