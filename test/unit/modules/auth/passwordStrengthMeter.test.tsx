import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordStrengthMeter } from '@/modules/auth/components/PasswordStrengthMeter';

afterEach(() => {
  cleanup();
});

describe('PasswordStrengthMeter', () => {
  it('muestra estado "Sin ingresar" cuando la contraseña está vacía', () => {
    render(<PasswordStrengthMeter password="" />);

    expect(screen.getByText('Sin ingresar')).toBeInTheDocument();
    expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('clasifica una contraseña corta como "Débil"', () => {
    render(<PasswordStrengthMeter password="abc" />);

    expect(screen.getByText('Débil')).toBeInTheDocument();
  });

  it('clasifica una contraseña con longitud y números como "Media"', () => {
    render(<PasswordStrengthMeter password="password123" />);

    expect(screen.getByText('Media')).toBeInTheDocument();
  });

  it('reconoce el cumplimiento de todos los requisitos como "Segura"', () => {
    render(<PasswordStrengthMeter password="Password123!#" />);

    expect(screen.getByText('Segura')).toBeInTheDocument();
    expect(screen.getByText('Una letra mayúscula (A-Z)')).toBeInTheDocument();
    expect(screen.getByText('Una letra minúscula (a-z)')).toBeInTheDocument();
    expect(screen.getByText('Un número (0-9)')).toBeInTheDocument();
    expect(screen.getByText('Un carácter especial (!@#$%^&*)')).toBeInTheDocument();
  });
});
