import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SunatConnectionTest } from '@/modules/invoices/components/SunatConnectionTest';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios',()=>({apiClient:{post:vi.fn()}}));
beforeEach(()=>vi.clearAllMocks());
afterEach(cleanup);
it('muestra conexión, vigencia y latencia sin ejecutar otra operación',async()=>{
  vi.mocked(apiClient.post).mockResolvedValue({data:{conectado:true,mensaje:'Consulta beta',latencia_ms:25,credenciales:'VERIFICADAS_EN_BETA',certificado:{estado:'VIGENTE',vence_el:'2099-01-01'}}});
  render(<SunatConnectionTest/>);fireEvent.click(screen.getByRole('button',{name:'Probar conexión SUNAT beta'}));
  expect(await screen.findByText('Conectado · 25 ms')).toBeInTheDocument();expect(screen.getByText(/Certificado: VIGENTE/)).toBeInTheDocument();expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/invoices/connection-test');
});
it('informa error de acceso o transporte',async()=>{
  vi.mocked(apiClient.post).mockRejectedValue(new Error('403'));render(<SunatConnectionTest/>);fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar');
});
