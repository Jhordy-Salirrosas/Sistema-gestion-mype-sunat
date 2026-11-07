/**
 * D1 · el checklist de configuración se muestra (M1).
 *
 * El backend devolvía `checklist` y `listo_para_emitir` desde TA-60, y el hook
 * los traía normalizados. La pantalla los descartaba: solo pintaba el RUC y las
 * series. Estas pruebas fijan que ahora SÍ se pintan y que el estado se lee tal
 * cual lo informa el servidor, sin reinterpretarlo en el front.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceConfigChecklist } from '@/modules/invoices/components/InvoiceConfigChecklist';
import type { ConfiguracionFeVista } from '@/modules/invoices/hooks/useInvoiceConfig';

/*
 * El proyecto NO tiene setup global de Testing Library y corre con `globals`
 * desactivados, así que el desmontaje automático no existe: sin esto cada
 * `render` acumula su árbol en el mismo documento y `getByText` encuentra el
 * texto de la prueba ANTERIOR, no el de la actual.
 */
afterEach(cleanup);

const base = (parcial: Partial<ConfiguracionFeVista> = {}): ConfiguracionFeVista => ({
  entorno: 'BETA',
  endpoint_bill_service: 'https://e-beta.sunat.gob.pe/billService',
  endpoint_consult_service: 'https://e-beta.sunat.gob.pe/billConsultService',
  listo_para_emitir: false,
  checklist: [
    {
      clave: 'entorno',
      descripcion: 'Entorno de SUNAT',
      configurado: true,
      obligatorio: true,
      detalle: 'BETA',
    },
    {
      clave: 'sol',
      descripcion: 'Usuario SOL',
      configurado: false,
      obligatorio: true,
      detalle: 'sin configurar: variable SOL_USER',
    },
    {
      clave: 'certificado',
      descripcion: 'Certificado digital',
      configurado: true,
      obligatorio: false,
      detalle: 'vence 2027-10-30',
    },
  ],
  series: [],
  ...parcial,
});

describe('D1 · checklist de configuración', () => {
  it('pinta cada requisito del backend', () => {
    render(<InvoiceConfigChecklist config={base()} />);

    expect(screen.getByText('Entorno de SUNAT')).toBeDefined();
    expect(screen.getByText('Usuario SOL')).toBeDefined();
    expect(screen.getByText('Certificado digital')).toBeDefined();
  });

  it('muestra el detalle que informa el servidor', () => {
    render(<InvoiceConfigChecklist config={base()} />);

    expect(screen.getByText('sin configurar: variable SOL_USER')).toBeDefined();
    expect(screen.getByText('vence 2027-10-30')).toBeDefined();
  });

  it('distingue un requisito que FALTA de uno OPCIONAL', () => {
    // No es lo mismo: un certificado ausente impide emitir; un correo de copia
    // sin configurar solo degrada. Pintar ambos igual haría creer que todo
    // bloquea.
    render(<InvoiceConfigChecklist config={base()} />);

    // El usuario SOL falta y es obligatorio.
    expect(screen.getByText('Falta')).toBeDefined();
    // El certificado está configurado pero es opcional: dice "Configurado" y
    // además se marca como opcional, para no confundirlo con un requisito duro.
    expect(screen.getAllByText('Configurado').length).toBeGreaterThan(0);
    expect(screen.getByText('Opcional')).toBeDefined();
  });

  it('un requisito opcional SIN configurar lo dice sin alarmar', () => {
    render(
      <InvoiceConfigChecklist
        config={base({
          checklist: [
            {
              clave: 'correo',
              descripcion: 'Correo de copia',
              configurado: false,
              obligatorio: false,
              detalle: 'sin configurar',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Sin configurar')).toBeDefined();
  });

  it('dice si el emisor puede facturar', () => {
    render(<InvoiceConfigChecklist config={base()} />);
    expect(screen.getByText('Hay requisitos sin cubrir')).toBeDefined();
  });

  it('con todo configurado dice que está listo', () => {
    render(<InvoiceConfigChecklist config={base({ listo_para_emitir: true })} />);
    expect(screen.getByText('Listo para emitir')).toBeDefined();
  });

  it('muestra los endpoints de SUNAT', () => {
    const { container } = render(<InvoiceConfigChecklist config={base()} />);

    // Se lee del textContent completo: `getByText` con una regex encuentra
    // ancestros y descendientes a la vez, y `billService` aparece dentro de
    // `billConsultService`.
    const texto = container.textContent ?? '';
    expect(texto).toContain('Servicio de facturación: ');
    expect(texto).toContain('/billService');
    expect(texto).toContain('Servicio de consulta: ');
    expect(texto).toContain('/billConsultService');
  });

  it('si el servidor no informa checklist, lo dice en vez de fingir vacío', () => {
    render(<InvoiceConfigChecklist config={base({ checklist: [] })} />);
    expect(
      screen.getByText('El servidor no informó el checklist de configuración.'),
    ).toBeDefined();
  });
});
