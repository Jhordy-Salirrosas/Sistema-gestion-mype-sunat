import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuthStore } from '@/stores/authStore';

afterEach(() => {
  useAuthStore.getState().logout();
});

describe('useRolePermissions Hook', () => {
  it('otorga permisos totales al rol ADMIN', () => {
    useAuthStore.getState().setSession('tok', {
      id: 'admin-1',
      email: 'admin@mype.pe',
      role: 'ADMIN',
      fullName: 'Admin User',
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canEmitInvoices).toBe(true);
    expect(result.current.canRegisterDua).toBe(true);
    expect(result.current.canCreateAccountingEntry).toBe(true);
    expect(result.current.canExportPle).toBe(true);
    expect(result.current.canReconcileSire).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it('permite registro DUA exclusivamente a OPERADOR_ADUANAS y restringe facturación', () => {
    useAuthStore.getState().setSession('tok', {
      id: 'aduanas-1',
      email: 'aduanas@mype.pe',
      role: 'OPERADOR_ADUANAS',
      fullName: 'Operador Aduanas',
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.isAduanas).toBe(true);
    expect(result.current.canRegisterDua).toBe(true);
    expect(result.current.canEmitInvoices).toBe(false);
    expect(result.current.canCreateAccountingEntry).toBe(false);
  });

  it('permite emisión de comprobantes a OPERADOR_FACTURACION y restringe aduanas/contabilidad', () => {
    useAuthStore.getState().setSession('tok', {
      id: 'fact-1',
      email: 'facturador@mype.pe',
      role: 'OPERADOR_FACTURACION',
      fullName: 'Facturador',
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.isFacturador).toBe(true);
    expect(result.current.canEmitInvoices).toBe(true);
    expect(result.current.canRegisterDua).toBe(false);
    expect(result.current.canCreateAccountingEntry).toBe(false);
  });

  it('restringe registro DUA y emisión a CONTADOR, permitiendo asientos y PLE', () => {
    useAuthStore.getState().setSession('tok', {
      id: 'cont-1',
      email: 'contador@mype.pe',
      role: 'CONTADOR',
      fullName: 'Contador',
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.isContador).toBe(true);
    expect(result.current.canCreateAccountingEntry).toBe(true);
    expect(result.current.canExportPle).toBe(true);
    expect(result.current.canReconcileSire).toBe(true);
    expect(result.current.canRegisterDua).toBe(false);
    expect(result.current.canEmitInvoices).toBe(false);
  });

  it('marca modo solo lectura estricto para AUDITOR', () => {
    useAuthStore.getState().setSession('tok', {
      id: 'aud-1',
      email: 'auditor@mype.pe',
      role: 'AUDITOR',
      fullName: 'Auditor',
    });

    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.isAuditor).toBe(true);
    expect(result.current.isReadOnly).toBe(true);
    expect(result.current.canEmitInvoices).toBe(false);
    expect(result.current.canRegisterDua).toBe(false);
    expect(result.current.canCreateAccountingEntry).toBe(false);
  });
});
