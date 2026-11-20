import { expect, it } from 'vitest';
import { INVOICE_SECTION_ROUTES, sectionFromPath } from '@/modules/invoices/lib/invoiceSections';
import { porApartado } from '@/modules/invoices/lib/invoiceFilters';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

it.each(Object.entries(INVOICE_SECTION_ROUTES))('la ruta de %s identifica su vista sin navegación por pestañas', (section,path)=>{
 expect(sectionFromPath(path)).toBe(section);
});
it('conserva la entrada general de facturación',()=>{
 expect(sectionFromPath('/invoices')).toBe('comprobantes');
});
it.each([
 ['comprobantes',['01','03']],['notas',['07','08']],['bajas',['RA','RC']],['monitor',['01','03','07','08','RA','RC']],
] as const)('la agrupación de %s conserva los tipos originales', (section,tipos)=>{
 const docs=(['01','03','07','08','RA','RC'] as const).map((tipo,i)=>construir({tipo,serie:'F001',correlativo:i+1,ruc:'20100070970',razonSocial:'Cliente',fecha:'2026-11-20',base:100,estado:'ACEPTADO'}));
 expect(porApartado(docs,section).map(d=>d.tipo)).toEqual(tipos);
});
