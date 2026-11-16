import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfigurationHub } from '@/modules/invoices/components/ConfigurationHub';
import { ConfigurationMenuLink } from '@/components/layout/ConfigurationMenuLink';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();useAuthStore.getState().logout();});
function mount(role:'ADMIN'|'AUDITOR') {useAuthStore.setState({user:{id:'actor',email:'actor@example.invalid',role}});render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><MemoryRouter><ConfigurationMenuLink/><ConfigurationHub/></MemoryRouter></QueryClientProvider>);}
it('el menú global y la agrupación se ocultan al no ADMIN sin consultar la API',()=>{mount('AUDITOR');expect(screen.queryByRole('link',{name:'Configuración'})).toBeNull();expect(apiClient.get).not.toHaveBeenCalled();});
it('ADMIN ve el acceso global y un error de API no muestra destinos',async()=>{vi.mocked(apiClient.get).mockRejectedValue(new Error('403'));mount('ADMIN');expect(screen.getByRole('link',{name:'Configuración'}).getAttribute('href')).toBe('/invoices/configuracion');expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron leer');});
it('ADMIN recibe destinos del servidor sin duplicar pantallas',async()=>{vi.mocked(apiClient.get).mockResolvedValue({data:[{label:'Configuración de importación',path:'/customs/config'}]});mount('ADMIN');expect((await screen.findByRole('link',{name:'Configuración de importación'})).getAttribute('href')).toBe('/customs/config');});
