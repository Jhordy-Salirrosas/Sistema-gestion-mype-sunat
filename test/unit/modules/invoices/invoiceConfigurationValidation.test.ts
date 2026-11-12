import { describe, it, expect } from 'vitest';
import { errorSerie, errorConfiguracionFiscal } from '@/modules/invoices/lib/invoiceConfigurationValidation';
describe('validación de series y configuración', () => {
  it.each([['01','F001'],['03','B001'],['07','FC01'],['07','BC01'],['08','FD01'],['08','BD01']])('conserva %s / %s', (tipo, serie) => expect(errorSerie(tipo, serie, '99999999')).toBeUndefined());
  it.each(['-1','1.2','100000000','','NaN'])('rechaza correlativo %s', n => expect(errorSerie('01','F001',n)).toBeTruthy());
  it('respeta tipo y no simplifica series', () => { expect(errorSerie('01','FC01','0')).toBeTruthy(); expect(errorSerie('07','F001','0')).toBeTruthy(); });
  it.each([['domicilio_fiscal',200],['departamento_fiscal',30],['provincia_fiscal',30],['distrito_fiscal',30]] as const)('limita %s', (campo, max) => { expect(errorConfiguracionFiscal({[campo]:'a'.repeat(max)})).toBeUndefined(); expect(errorConfiguracionFiscal({[campo]:'a'.repeat(max+1)})).toBeTruthy(); });
  it('preserva ceros iniciales de códigos fiscales', () => { expect(errorConfiguracionFiscal({ubigeo_fiscal:'010101',local_anexo:'0000'})).toBeUndefined(); expect(errorConfiguracionFiscal({ubigeo_fiscal:'10101'})).toBeTruthy(); expect(errorConfiguracionFiscal({local_anexo:'1e03'})).toBeTruthy(); });
});
