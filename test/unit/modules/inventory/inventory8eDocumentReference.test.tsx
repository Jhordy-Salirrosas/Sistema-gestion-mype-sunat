import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import InventoryKardexPage from '@/modules/inventory/pages/InventoryKardexPage';
import {inventoryLedgerApi} from '@/modules/inventory/services/inventoryLedgerApi';
import {formatearReferenciaDocumento,numeroDocumentoSinSerie} from '@/modules/inventory/lib/documentReference';
vi.mock('@/modules/inventory/services/inventoryLedgerApi',()=>({inventoryLedgerApi:{getKardex:vi.fn(),getWarehouses:vi.fn(async()=>[])}}));
vi.mock('@/modules/inventory/services/inventoryApi',()=>({inventoryApi:{getStockBalances:vi.fn(async()=>({balances:[]}))}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it.each([['FC01','FC01-00000014','FC01-00000014','00000014'],['FC01','00000014','FC01-00000014','00000014'],[null,'SI-2026','SI-2026','SI-2026'],['FC01','OTRA-123','OTRA-123','OTRA-123'],['FC01','M1','FC01-M1','M1'],[null,null,'','']])('referencia %s/%s',(serie,numero,visible,ple)=>{expect(formatearReferenciaDocumento(serie,numero)).toBe(visible);expect(numeroDocumentoSinSerie(serie,numero)).toBe(ple);});
it('Kardex general muestra igual el documento completo y el correlativo suelto',async()=>{
 const row={date:'2026-11-11',movementNumber:'M1',operationTypeCode:'05',operationLabel:'Devolución',documentTypeCode:'07',documentSerial:'FC01',sku:'CEM-001',description:'Cemento',unitCode:'NIU',warehouseCode:'ALM-01',direction:'ENTRADA',quantity:1,unitCost:10,totalCost:10,resultingStock:1,resultingAverageCost:10,resultingTotalValue:10,balanceAfter:1};
 vi.mocked(inventoryLedgerApi.getKardex).mockResolvedValue({movements:[{...row,id:'full',documentNumber:'FC01-00000014'},{...row,id:'bare',documentNumber:'00000014'}],opening:{stock:0,unitCost:10,totalValue:0},final:{stock:2,unitCost:10,totalValue:20},totals:{entriesQuantity:2,exitsQuantity:0,entries:20,exits:0},internalTransfers:{count:0,entriesQuantity:0,exitsQuantity:0}} as never);
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={q}><MemoryRouter><InventoryKardexPage/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findAllByText('[07] FC01-00000014')).toHaveLength(2);expect(screen.queryByText(/FC01-FC01/)).toBeNull();q.clear();
});
