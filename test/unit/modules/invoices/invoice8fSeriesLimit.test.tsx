import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { InvoiceNextNumber } from '@/modules/invoices/components/InvoiceNextNumber';
import { aSerieFe } from '@/modules/invoices/hooks/useInvoiceConfig';
afterEach(cleanup);
it('muestra el último correlativo válido',()=>{render(<InvoiceNextNumber serie="F001" actual={99999998}/>);expect(screen.getByText(/F001-99999999/)).not.toBeNull();});
it('serie agotada no promete noveno dígito',()=>{render(<InvoiceNextNumber serie="F001" actual={99999999}/>);expect(screen.getByRole('alert').textContent).toContain('Serie agotada');expect(screen.queryByText(/100000000/)).toBeNull();});
it('configuración no calcula próximo de serie agotada',()=>{expect(aSerieFe({document_type:'01',series:'F001',is_active:true,current_correlative:99999999}).siguienteCorrelativo).toBeUndefined();expect(aSerieFe({document_type:'01',series:'F001',is_active:true,current_correlative:99999998}).siguienteCorrelativo).toBe(99999999);});
