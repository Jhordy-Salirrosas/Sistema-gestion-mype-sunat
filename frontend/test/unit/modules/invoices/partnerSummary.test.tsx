import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { PartnerDetailDrawer } from '@/modules/customs/components/PartnerDetailDrawer';
import { resumenTercero } from '@/modules/customs/lib/partnerSummary';
const partner={id:'p',doc_type:'6',doc_number:'20100070970',legal_name:'Empresa',country_code:'PE',roles:['CLIENTE'],is_active:true,email:null,phone:null,address:null,contacts:[],addresses:[],bank_accounts:[],primary_contact:{id:'c',name:'Contacto',is_primary:true,email:'principal@example.com',phone:'999111222'},primary_address:{id:'a',address:'Av. Principal',label:'PRINCIPAL',country_code:'PE',is_default:true}};
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async(url:string)=>({data:url.endsWith('tax-status')?[]:partner}))}}));
afterEach(cleanup);
it('resuelve principales y conserva fallback para API histórica',()=>{
 expect(resumenTercero(partner as never)).toEqual({email:'principal@example.com',phone:'999111222',address:'Av. Principal'});
 expect(resumenTercero({email:'cabecera',phone:'tel',address:'dir'} as never)).toEqual({email:'cabecera',phone:'tel',address:'dir'});
});
it('el formulario de edición abre con las mismas fuentes principales',()=>{
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={q}><PartnerFormDialog partner={partner as never} onClose={vi.fn()}/></QueryClientProvider>);
 expect(screen.getByLabelText('Email de contacto')).toHaveValue('principal@example.com');expect(screen.getByLabelText('Teléfono')).toHaveValue('999111222');expect(screen.getByLabelText('Dirección fiscal / operativa')).toHaveValue('Av. Principal');q.clear();
});
it('General muestra los principales registrados',async()=>{
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={q}><PartnerDetailDrawer partnerId="p" onClose={vi.fn()}/></QueryClientProvider>);
 expect(await screen.findByText('principal@example.com')).toBeTruthy();expect(screen.getByText('999111222')).toBeTruthy();expect(screen.getByText('Av. Principal')).toBeTruthy();q.clear();
});
