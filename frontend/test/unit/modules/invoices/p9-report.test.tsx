import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import SalesReportPage from '@/modules/invoices/pages/SalesReportPage';
import {apiClient} from '@/lib/axios';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('utilidad nula se distingue del cero en cada agrupación y su exportación',async()=>{
 const row={document:'20100070970',customer:'Cliente',documents:1,sales:118,cost:0};
 vi.mocked(apiClient.get).mockResolvedValue({data:{from:'2026-11-01',to:'2026-11-12',totals:{sales:236,taxable:200,igv:36,cost:0,profit:0,margin:0,documents:2,withoutCost:{count:1,sales:118}},byCustomer:[{...row,profit:null},{...row,document:'2',profit:0}],byDocument:[{...row,id:'1',number:'F001-1',date:'2026-11-12',total:118,profit:null,hasCost:false},{...row,id:'2',number:'F001-2',date:'2026-11-12',total:118,profit:0,hasCost:true}],daily:[{date:'2026-11-11',sales:118,cost:0,profit:null},{date:'2026-11-12',sales:118,cost:0,profit:0}]}});
 const blobs:Blob[]=[];vi.stubGlobal('URL',{createObjectURL:vi.fn((b:Blob)=>{blobs.push(b);return 'blob:test';}),revokeObjectURL:vi.fn()});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={q}><SalesReportPage/></QueryClientProvider>);
 await screen.findByText('Sin costo');
 for(const name of ['Clientes','Comprobantes','Días']){fireEvent.click(screen.getByRole('button',{name}));expect(screen.getAllByText('Sin costo').length).toBeGreaterThan(0);expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);fireEvent.click(screen.getByRole('button',{name:'Exportar CSV'}));}
 expect(blobs).toHaveLength(3);q.clear();
});
