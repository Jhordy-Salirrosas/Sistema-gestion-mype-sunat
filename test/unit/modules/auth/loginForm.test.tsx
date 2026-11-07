import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from '@/modules/auth/components/LoginForm';
import { loginSchema } from '@/modules/auth/validators/authSchema';

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

describe('LoginForm & Demo Box', () => {
  it('renderiza inputs de email, contraseña y botón de acceso', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/Correo Corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Sesión/i })).toBeInTheDocument();
  });

  it('renderiza la caja de acceso rápido con los 5 botones demo', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByText('Acceso Rápido Demo (1-Clic)')).toBeInTheDocument();
    expect(screen.getByTitle(/Iniciar como Admin/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Iniciar como Contador/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Iniciar como Facturador/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Iniciar como Aduanas/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Iniciar como Auditor/i)).toBeInTheDocument();
  });

  it('autocompleta credenciales al presionar un botón demo', () => {
    renderWithProviders(<LoginForm />);

    const adminBtn = screen.getByTitle(/Iniciar como Admin/i);
    fireEvent.click(adminBtn);

    const emailInput = screen.getByLabelText(/Correo Corporativo/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Contraseña') as HTMLInputElement;

    expect(emailInput.value).toBe('admin@mype.pe');
    expect(passwordInput.value).toBe('Password123!#');
  });

  it('loginSchema valida sintaxis de correo y longitud de contraseña', () => {
    const valid = loginSchema.safeParse({
      email: 'admin@mype.pe',
      password: 'Password123!#',
    });
    expect(valid.success).toBe(true);

    const invalidEmail = loginSchema.safeParse({
      email: 'correo-invalido',
      password: 'Password123!#',
    });
    expect(invalidEmail.success).toBe(false);

    const shortPass = loginSchema.safeParse({
      email: 'admin@mype.pe',
      password: '123',
    });
    expect(shortPass.success).toBe(false);
  });
});
