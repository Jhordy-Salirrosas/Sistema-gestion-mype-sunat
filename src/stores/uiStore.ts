import { create } from 'zustand';

export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface UiState {
  isSidebarCollapsed: boolean;
  sunatCircuitBreakerStatus: CircuitBreakerStatus;
  
  // Acciones
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSunatCircuitBreakerStatus: (status: CircuitBreakerStatus) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  sunatCircuitBreakerStatus: 'CLOSED', // Por defecto SUNAT está operativa

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSidebarCollapsed: (collapsed: boolean) =>
    set({ isSidebarCollapsed: collapsed }),

  setSunatCircuitBreakerStatus: (status: CircuitBreakerStatus) =>
    set({ sunatCircuitBreakerStatus: status }),
}));
