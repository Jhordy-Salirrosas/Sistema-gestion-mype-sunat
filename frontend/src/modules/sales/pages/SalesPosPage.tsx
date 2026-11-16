import { useCommercialDefaults, permittedDefault } from '@/modules/invoices/hooks/useCommercialDefaults';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { CreditCard, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { apiClient } from '@/lib/axios';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { cargarProductosAlmacen } from '@/modules/invoices/services/inventoryProductsApi';
import type { ProductoBuscado } from '@/modules/invoices/lib/invoiceSearch';
import { collectionsApi } from '@/modules/collections/services/collectionsApi';
import { salesQuotesApi } from '../services/salesQuotesApi';
import { documentoTerceroValido } from '@/modules/customs/libPartnerValidation';

interface Serie { document_type: string; series: string; is_active: boolean }
interface Linea { producto: ProductoBuscado; cantidad: number }

const hoy = new Date().toISOString().slice(0, 10);
const enDias = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
const money = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesPosPage() {
  const [almacenes, setAlmacenes] = useState<Array<{ warehouse_code: string; description: string }>>([]);
  const [almacen, setAlmacen] = useState('ALM-01');
  const [series, setSeries] = useState<Serie[]>([]);
  const [tipo, setTipo] = useState<'01' | '03'>('03');
  const [productos, setProductos] = useState<ProductoBuscado[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [documento, setDocumento] = useState('');
  const [cliente, setCliente] = useState('');
  const [tipoDoc, setTipoDoc] = useState('6');
  const [medioPago, setMedioPago] = useState('EFECTIVO');
  const [error, setError] = useState('');
  const errorDocumento = tipoDoc === '0' ? '' : documento.trim() === '' ? 'Indique el documento del cliente.' : documentoTerceroValido(tipoDoc, documento.trim()) ? '' : tipoDoc === '6' ? 'RUC inválido: 11 dígitos y módulo 11.' : 'DNI inválido: 8 dígitos.';
  const [venta, setVenta] = useState<{ numero: string; total: number; cobroPendiente?: string; credito?: boolean; fecha: string; cliente: string; documento: string; tipo: string; serie: string; medioPago: string; formaPago: string; items: Array<{ descripcion: string; cantidad: number; precio: number; total: number }> } | null>(null);
  const [ticketAbierto, setTicketAbierto] = useState(false);
  const empresa = useAuthStore((s) => s.activeCompany);
  const [formaPago, setFormaPago] = useState<'Contado' | 'Credito'>('Contado');
  const actor = useAuthStore(state => state.user?.id);
  const { data: paymentDefaults, isError: defaultsError } = useCommercialDefaults();
  const { data: customerPermissions } = useQuery({
    queryKey: ['pos-customer-permissions', empresa?.tenantId, actor, tipoDoc, documento],
    enabled: tipoDoc !== '0' && !errorDocumento && Boolean(documento.trim()), retry: false,
    queryFn: async () => (await masterDataApi.getPartners({ role: 'CLIENTE', q: documento.trim() })).find(partner => partner.is_active && partner.roles.includes('CLIENTE') && partner.doc_type === tipoDoc && partner.doc_number === documento.trim()) ?? null,
  });
  const creditAllowed = tipo === '01' && customerPermissions?.has_credit === true;
  useEffect(() => {
    if (paymentDefaults) { setFormaPago(permittedDefault(paymentDefaults, creditAllowed, tipo)); setMedioPago(paymentDefaults.medio_pago); }
  }, [paymentDefaults, creditAllowed, tipo]);

  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quote');
  const [vencimiento, setVencimiento] = useState(enDias(30));

  useEffect(() => {
    void apiClient.get('/invoices/warehouses').then(({ data }) => {
      const lista = Array.isArray(data) ? data : [];
      setAlmacenes(lista);
      if (lista[0]?.warehouse_code) setAlmacen(lista[0].warehouse_code);
    }).catch(() => setError('No se pudieron cargar los almacenes.'));
    void apiClient.get('/invoices/config').then(({ data }) => setSeries(data.series ?? [])).catch(() => setError('No se pudo cargar la configuración de series.'));
  }, []);

  useEffect(() => {
    void cargarProductosAlmacen(almacen).then(setProductos).catch(() => setError('No se pudo cargar el catálogo del almacén.'));
  }, [almacen]);

  useEffect(() => {
    if (!quoteId) return;
    void salesQuotesApi.get(quoteId).then((q) => {
      setCliente(q.customerName);
      setDocumento(q.customerDocNumber ?? '');
      setTipoDoc(q.customerDocType || '6');
      setCarrito(q.items.map((i, index) => ({
        producto: {
          sku: i.sku || `COT-${q.quoteNumber}-${index + 1}`,
          descripcion: i.description,
          unidad: i.unitCode || 'NIU',
          valorUnitario: Number((i.unitPrice / 1.18).toFixed(10)),
          precioUnitario: i.unitPrice,
          stock: 999,
          vendible: true,
          afectacion: '10',
        },
        cantidad: i.quantity,
      })));
    }).catch(() => setError('No se pudo cargar la cotización.'));
  }, [quoteId]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos.slice(0, 12);
    return productos.filter((p) => p.sku.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)).slice(0, 20);
  }, [productos, busqueda]);
  const serie = series.find((s) => s.document_type === tipo && s.is_active)?.series ?? '';
  const total = carrito.reduce((sum, l) => sum + Number(l.producto.precioUnitario ?? 0) * l.cantidad, 0);

  const agregar = (p: ProductoBuscado) => {
    setCarrito((prev) => {
      const existe = prev.find((l) => l.producto.sku === p.sku);
      return existe ? prev.map((l) => l.producto.sku === p.sku ? { ...l, cantidad: l.cantidad + 1 } : l) : [...prev, { producto: p, cantidad: 1 }];
    });
    setVenta(null);
    setError('');
  };
  const cambiarCantidad = (sku: string, cantidad: number) => setCarrito((prev) => prev.map((l) => l.producto.sku === sku ? { ...l, cantidad: Math.max(1, cantidad) } : l));

  const cobrar = useMutation({
    mutationFn: async () => {
      if (!serie) throw new Error('No hay una serie activa para el tipo de comprobante.');
      if (!cliente.trim()) throw new Error('Indique el cliente.');
      if (errorDocumento) throw new Error(errorDocumento);
      if (!carrito.length) throw new Error('Agregue al menos un producto.');
      if (formaPago === 'Credito' && !vencimiento) throw new Error('Indique el vencimiento de la venta al crédito.');
      const resultado = await invoicesApi.emitirComprobante({
        tipo_comprobante: tipo,
        serie,
        almacen,
        customer_identity_type: tipoDoc,
        customer_identity_number: documento.trim() || undefined,
        customer_legal_name: cliente.trim(),
        forma_pago: formaPago,
        ...(formaPago === 'Contado' ? { medio_pago: medioPago as never } : {}),
        ...(formaPago === 'Credito' ? { cuotas: [{ monto: Number(total.toFixed(2)), vencimiento }] } : {}),
        items: carrito.map((l) => ({
          codigo: l.producto.sku,
          descripcion: l.producto.descripcion,
          unidad: l.producto.unidad || 'NIU',
          cantidad: l.cantidad,
          valorUnitario: Number(l.producto.valorUnitario ?? 0),
          precioUnitario: Number(l.producto.precioUnitario ?? 0),
          afectacion: (l.producto.afectacion || '10') as never,
        })),
      }, crypto.randomUUID());
      let cobroPendiente = '';
      if (formaPago === 'Credito') return { ...resultado, cobroPendiente, credito: true };
      // La boleta puede quedar EN_COLA unos segundos: el cobro exige ACEPTADO.
      for (let intento = 0; intento < 12; intento++) {
        try {
          await collectionsApi.create({
            customerName: cliente.trim(),
            customerDoc: documento.trim() || undefined,
            invoiceNumber: resultado.numero,
            description: `Venta POS ${resultado.numero}`,
            paymentMethod: medioPago,
            amount: Number(resultado.monto_total),
          });
          cobroPendiente = '';
          break;
        } catch (e: unknown) {
          cobroPendiente = extractApiErrorMessage(e, 'No se pudo registrar el cobro.');
          const transitorio = /aceptad|saldo|cola|procesando|todav[ií]a/i.test(cobroPendiente);
          if (!transitorio || intento === 11) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      return { ...resultado, cobroPendiente, credito: false };
    },
    onSuccess: (resultado) => {
      setVenta({ numero: resultado.numero, total: Number(resultado.monto_total), cobroPendiente: resultado.cobroPendiente, credito: resultado.credito, fecha: new Date().toISOString(), cliente: cliente.trim(), documento: documento.trim(), tipo, serie, medioPago, formaPago, items: carrito.map((l) => ({ descripcion: l.producto.descripcion, cantidad: l.cantidad, precio: Number(l.producto.precioUnitario ?? 0), total: l.cantidad * Number(l.producto.precioUnitario ?? 0) })) });
      if (quoteId) void salesQuotesApi.status(quoteId, 'CONVERTIDA');
      setCarrito([]);
      setFormaPago(permittedDefault(paymentDefaults, creditAllowed, tipo));
      setMedioPago(paymentDefaults?.medio_pago ?? 'EFECTIVO');
      setError('');
    },
    onError: (e: unknown) => setError(extractApiErrorMessage(e, 'No se pudo registrar la venta.')),
  });

  return (
    <Page>
      <PageHeader title="Punto de venta" description="Venta rápida con emisión de comprobante y registro de cobro." />
      {defaultsError && <p role="alert">No se pudo leer el pago predeterminado. Verifique la condición y el medio antes de emitir.</p>}
      {venta ? <div className="mb-4 rounded-md border border-emerald-600/40 bg-emerald-50 p-3 text-sm text-emerald-800">Venta registrada: <strong>{venta.numero}</strong> · {money(venta.total)}{venta.credito ? <p className="mt-1 text-xs text-sky-700">Venta al crédito: el saldo quedó en Cuentas por cobrar.</p> : null}{venta.cobroPendiente ? <p className="mt-1 text-xs text-amber-700">Cobro pendiente: {venta.cobroPendiente} Revise el estado del comprobante y del puente en el monitor.</p> : null}<Button size="sm" variant="outline" className="mt-2" onClick={() => setTicketAbierto(true)}>Ver ticket</Button></div> : null}
      {error ? <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select aria-label="Almacén" className="h-9 rounded-md border bg-background px-3 text-xs" value={almacen} onChange={(e) => setAlmacen(e.target.value)}>
              {almacenes.map((a) => <option key={a.warehouse_code} value={a.warehouse_code}>{a.warehouse_code} · {a.description}</option>)}
            </select>
            <select aria-label="Tipo de comprobante" className="h-9 rounded-md border bg-background px-3 text-xs" value={tipo} onChange={(e) => setTipo(e.target.value as '01' | '03')}>
              <option value="03">Boleta</option>
              <option value="01">Factura</option>
            </select>
            <Badge variant="outline">Serie {serie || 'sin serie'}</Badge>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus className="pl-8" placeholder="Buscar producto por SKU o descripción (Enter agrega el primero)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && filtrados[0]) { e.preventDefault(); agregar(filtrados[0]); } }} />
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead align="right">Precio</TableHead><TableHead align="right">Stock</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {filtrados.map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell><p className="text-xs font-medium">{p.descripcion}</p><p className="text-[11px] text-muted-foreground">{p.sku}</p></TableCell>
                    <TableCell align="right" className="text-xs">{money(Number(p.precioUnitario ?? 0))}</TableCell>
                    <TableCell align="right" className="text-xs">{Number(p.stock ?? 0)}</TableCell>
                    <TableCell align="right"><Button size="sm" variant="ghost" onClick={() => agregar(p)} disabled={Number(p.stock ?? 0) <= 0}><Plus className="h-3.5 w-3.5" />Agregar</Button></TableCell>
                  </TableRow>
                ))}
                {filtrados.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">Sin productos vendibles.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4" />Carrito ({carrito.length})</div>
          <div className="mb-3 grid grid-cols-[90px_1fr] gap-2">
            <select aria-label="Tipo de documento" className="h-9 rounded-md border bg-background px-2 text-xs" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
              <option value="6">RUC</option><option value="1">DNI</option><option value="0">Sin doc.</option>
            </select>
            <Input aria-label="Documento del cliente" inputMode="numeric" maxLength={tipoDoc === '6' ? 11 : tipoDoc === '1' ? 8 : 20} placeholder={tipoDoc === '6' ? 'RUC de 11 dígitos' : tipoDoc === '1' ? 'DNI de 8 dígitos' : 'Sin documento'} value={documento} onChange={(e) => { const v = tipoDoc === '0' ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, tipoDoc === '6' ? 11 : 8); setDocumento(v); }} onBlur={() => {
                  if (errorDocumento || !documento.trim()) return;
                  const doc = documento.trim();
                  const desdeMaestro = () => invoicesApi.buscarClientes(doc).then((lista) => {
                    const match = lista.find((c) => c.numeroDocumento === doc);
                    if (match?.razonSocial) setCliente(match.razonSocial);
                  }).catch(() => undefined);
                  if (tipoDoc === '6') {
                    void apiClient.get<{ razonSocial?: string }>(`/sunat/ruc/${doc}`)
                      .then(({ data }) => { if (data.razonSocial) setCliente(data.razonSocial); else return desdeMaestro(); })
                      .catch(() => desdeMaestro());
                  } else if (tipoDoc === '1') {
                    void apiClient.get<{ nombreCompleto?: string }>(`/sunat/dni/${doc}`)
                      .then(({ data }) => { if (data.nombreCompleto) setCliente(data.nombreCompleto); else return desdeMaestro(); })
                      .catch(() => desdeMaestro());
                  } else {
                    void desdeMaestro();
                  }
                }} />
          </div>
          <Input aria-label="Nombre del cliente" className="mb-1" placeholder="Razón social / nombre" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          {errorDocumento ? <p className="mb-3 text-[11px] text-destructive">{errorDocumento}</p> : <div className="mb-3" />}
          <div className="mb-3 space-y-2">
            {carrito.map((l) => (
              <div key={l.producto.sku} className="flex items-center gap-2 rounded border p-2 text-xs">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.producto.descripcion}</p><p className="text-[10px] text-muted-foreground">{money(Number(l.producto.precioUnitario ?? 0))} c/u</p></div>
                <Input aria-label={`Cantidad ${l.producto.sku}`} className="h-7 w-16" type="number" min={1} value={l.cantidad} onChange={(e) => cambiarCantidad(l.producto.sku, Number(e.target.value))} />
                <span className="w-20 text-right font-mono">{money(l.cantidad * Number(l.producto.precioUnitario ?? 0))}</span>
                <Button size="sm" variant="ghost" onClick={() => setCarrito((prev) => prev.filter((x) => x.producto.sku !== l.producto.sku))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            {carrito.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Agregue productos para vender.</p> : null}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs">Condición<select aria-label="Condición de pago" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs" value={formaPago} onChange={(e) => setFormaPago(e.target.value as 'Contado' | 'Credito')}><option value="Contado">Contado</option><option value="Credito" disabled={!creditAllowed}>Crédito</option></select></label>
            {formaPago === 'Credito' ? <label className="text-xs">Vencimiento<Input aria-label="Vencimiento" type="date" min={hoy} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} /></label> : <label className="text-xs">Medio de pago<select aria-label="Medio de pago" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs" value={medioPago} onChange={(e) => setMedioPago(e.target.value)}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TARJETA">Tarjeta</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="DEPOSITO">Depósito</option><option value="CHEQUE">Cheque</option></select></label>}
          </div>
          <div className="mb-3 flex items-center justify-between border-t pt-3 text-sm"><span>Total</span><strong className="font-mono text-lg">{money(total)}</strong></div>
          <Button fullWidth disabled={cobrar.isPending || !carrito.length || !cliente.trim() || !serie || Boolean(errorDocumento)} onClick={() => cobrar.mutate()}><CreditCard className="mr-2 h-4 w-4" />{cobrar.isPending ? 'Registrando…' : formaPago === 'Credito' ? 'Emitir al crédito' : 'Cobrar y emitir'}</Button>
        </Card>
      </div>
      {venta && ticketAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div id="ticket-print" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-5 text-black shadow-xl">
            <div className="text-center">
              <p className="text-sm font-bold">{empresa?.razonSocial ?? 'SYNC-SUNAT'}</p>
              <p className="text-[11px]">RUC {empresa?.ruc ?? '—'}</p>
              <p className="mt-2 text-xs font-semibold">{venta.tipo === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA'}</p>
              <p className="font-mono text-sm">{venta.numero}</p>
              <p className="text-[11px]">{new Date(venta.fecha).toLocaleString('es-PE')}</p>
            </div>
            <div className="my-3 border-y border-dashed py-2 text-[11px]">
              <p>Cliente: {venta.cliente}</p>
              <p>Documento: {venta.documento || '—'}</p>
              <p>Condición: {venta.formaPago}{venta.formaPago === 'Contado' ? ` · ${venta.medioPago}` : ''}</p>
            </div>
            <table className="w-full text-[11px]">
              <thead><tr className="border-b"><th className="text-left">Cant.</th><th className="text-left">Descripción</th><th className="text-right">Total</th></tr></thead>
              <tbody>{venta.items.map((i, idx) => <tr key={idx}><td>{i.cantidad}</td><td>{i.descripcion}</td><td className="text-right font-mono">{money(i.total)}</td></tr>)}</tbody>
            </table>
            <div className="mt-3 border-t pt-2 text-right text-sm font-bold">TOTAL {money(venta.total)}</div>
            {venta.credito ? <p className="mt-2 text-[10px]">Venta al crédito: pendiente en Cuentas por cobrar.</p> : null}
            <p className="mt-3 text-center text-[10px]">Gracias por su compra</p>
            <div className="no-print mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}>Imprimir</Button>
              <Button variant="outline" onClick={() => setTicketAbierto(false)}>Cerrar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
