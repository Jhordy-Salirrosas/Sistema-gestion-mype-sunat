import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceIntegerInput } from '@/modules/invoices/components/InvoiceIntegerInput';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { actualizarItem, itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
afterEach(cleanup);
function Campo({ inicial = 1 }: { inicial?: number }) {
  const [value, setValue] = useState(inicial);
  return <><InvoiceIntegerInput aria-label="Cantidad" min={1} value={value} onValue={setValue} /><output aria-label="Cantidad guardada">{String(value)}</output></>;
}
it.each(['1.001', '2.5', '2,5'])('escribir %s conserva solo la parte entera y nunca concatena la fracción', async texto => {
  render(<Campo />);const input = screen.getByRole('spinbutton');const user = userEvent.setup();
  await user.clear(input);await user.type(input, texto);
  expect(input).toHaveValue(Number(texto.split(/[.,]/)[0]));
  await user.tab();expect(screen.getByLabelText('Cantidad guardada')).toHaveTextContent(texto.split(/[.,]/)[0]);
});
it.each(['1.001', '2.5', '2,5'])('pegar %s descarta la fracción', texto => {
  render(<Campo />);const input = screen.getByRole('spinbutton');
  fireEvent.paste(input,{clipboardData:{getData:()=>texto}});
  expect(input).toHaveValue(Number(texto.split(/[.,]/)[0]));
});
it('un cambio decimal completo se trunca y un entero normal no cambia', () => {
  render(<Campo />);const input = screen.getByRole('spinbutton');
  fireEvent.change(input,{target:{value:'2.5'}});expect(input).toHaveValue(2);
  fireEvent.change(input,{target:{value:'7'}});expect(input).toHaveValue(7);
});
it('spinner y atributos avanzan de uno en uno', () => {
  render(<Campo />);const input = screen.getByRole('spinbutton') as HTMLInputElement;
  expect(input.step).toBe('1');input.stepUp();fireEvent.input(input);expect(input).toHaveValue(2);
  input.stepDown();fireEvent.input(input);expect(input).toHaveValue(1);
});
it('signos y exponentes se rechazan; vacío y decimal heredado salen como enteros', () => {
  const {unmount}=render(<Campo inicial={3}/>);const input=screen.getByRole('spinbutton');
  for(const texto of ['-1','1e3']){fireEvent.paste(input,{clipboardData:{getData:()=>texto}});expect(input).toHaveValue(3);}
  fireEvent.change(input,{target:{value:''}});fireEvent.blur(input);expect(input).toHaveValue(1);unmount();
  render(<Campo inicial={2.5}/>);expect(screen.getByLabelText('Cantidad guardada')).toHaveTextContent('2');fireEvent.blur(screen.getByRole('spinbutton'));expect(screen.getByLabelText('Cantidad guardada')).toHaveTextContent('2');
});
it.each(['NIU','KGM','ZZ'].flatMap(unidad=>[false,true].map(esNota=>({unidad,esNota}))))('$unidad, nota=$esNota: cantidad entera, límite y descuento heredado conservados', ({unidad,esNota}) => {
  const onCambiar=vi.fn();
  const item=itemDesdeProducto({sku:'CLV-2',descripcion:'Clavo',unidad,valorUnitario:7.75,precioUnitario:9.145,afectacion:'10',discountRate:10},'p');
  render(<InvoiceItemsGrid items={[item]} esNota={esNota} cantidadesMaximas={[3]} onCambiar={onCambiar} onEliminar={vi.fn()}/>);
  const input=screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement;
  expect(input.type).toBe('number');expect(input.step).toBe('1');expect(input.max).toBe('3');
  fireEvent.change(input,{target:{value:'2.5'}});expect(onCambiar).toHaveBeenLastCalledWith(0,expect.objectContaining({cantidad:2,descuento:expect.objectContaining({monto:1.55})}));
});
it('Bolsas usa el mismo control entero, acepta cero y mantiene paso uno', () => {
  function Bolsas(){const[items,setItems]=useState([itemDesdeProducto({sku:'P',descripcion:'Producto',unidad:'KGM',valorUnitario:100,afectacion:'10'},'p')]);return <InvoiceItemsGrid items={items} onCambiar={(i,p)=>setItems(v=>[...actualizarItem(v,i,p)])} onEliminar={vi.fn()}/>;}
  render(<Bolsas/>);const input=screen.getByLabelText('ICBPER de la línea 1') as HTMLInputElement;
  expect(input.step).toBe('1');fireEvent.change(input,{target:{value:'2.5'}});expect(input).toHaveValue(2);
  fireEvent.change(input,{target:{value:'0'}});fireEvent.blur(input);expect(input).toHaveValue(0);
});

it('pegar un entero conserva la edición normal del campo', async () => {
  render(<Campo/>);const user=userEvent.setup();const input=screen.getByRole('spinbutton');
  await user.clear(input);await user.paste('03');expect(input).toHaveValue(3);
});
