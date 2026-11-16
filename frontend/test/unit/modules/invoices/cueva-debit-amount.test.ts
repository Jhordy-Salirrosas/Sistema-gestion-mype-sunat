import { expect, it } from 'vitest';
import { applyDebitAmount } from '@/modules/invoices/lib/invoiceDebitAmount';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
const draft=()=>({...borradorInicial('08','2026-11-16'),items:[{clave:'one',codigo:'SKU',descripcion:'Origen',unidad:'NIU',cantidad:1,valorUnitario:100,precioUnitario:118,afectacion:'GRAVADA' as const,icbper:0}]});
it('aplica monto parcial exacto y conserva identidad/cantidad de las líneas',()=>{const b=draft();const n=applyDebitAmount(b,35.4,118);expect(calcularFlujo(n).importeTotal).toBe(35.4);expect(n.items[0]).toMatchObject({codigo:'SKU',cantidad:1,unidad:'NIU'});expect(b.items[0].valorUnitario).toBe(100);});
it('aplica el total del saldo y rechaza excesos, cero y precisión inválida',()=>{expect(calcularFlujo(applyDebitAmount(draft(),118,118)).importeTotal).toBe(118);for(const n of [119,0,3.002]) expect(()=>applyDebitAmount(draft(),n,118)).toThrow();});
