import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegisterForm } from '@/modules/auth/components/RegisterForm';
import { validateRucModulo11 } from '@/modules/auth/validators/rucValidator';

afterEach(() => {
  cleanup();
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RegisterForm & RUC Modulo 11', () => {
  it('renderiza correctamente los 2 bloques: MYPE y Administrador', () => {
    renderWithProviders(<RegisterForm />);

    expect(screen.getByText('1. Datos de la MYPE')).toBeInTheDocument();
    expect(screen.getByText('2. Administrador Principal')).toBeInTheDocument();
    expect(screen.getByLabelText(/RUC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Razón Social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Usuario SOL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Clave SOL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña Maestra/i)).toBeInTheDocument();
  });

  it('validador de RUC Módulo 11 aprueba RUCs oficiales válidos', () => {
    // 20601012341 es el RUC del emisor demo y supera el módulo 11
    expect(validateRucModulo11('20601012341')).toBe(true);
    // 20100070970 es RUC válido de Superintendencia SUNAT
    expect(validateRucModulo11('20100070970')).toBe(true);
  });

  it('validador de RUC Módulo 11 no deja pasar el RUC demo antiguo (dígito inválido)', () => {
    // 20601234567 fallaba el módulo 11 y sólo pasaba por una excepción hardcodeada
    expect(validateRucModulo11('20601234567')).toBe(false);
  });

  it('validador de RUC Módulo 11 rechaza RUCs con dígito verificador adulterado o longitud incorrecta', () => {
    // Dígito verificador alterado
    expect(validateRucModulo11('20601234568')).toBe(false);
    // Menos de 11 dígitos
    expect(validateRucModulo11('206012345')).toBe(false);
    // Prefijo inválido (no empieza con 10, 15, 16, 17, 20)
    expect(validateRucModulo11('30601234567')).toBe(false);
  });
});
