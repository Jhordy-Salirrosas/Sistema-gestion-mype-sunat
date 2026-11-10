import { useEffect, useState } from 'react';
import { Page, PageHeader, Button } from '@/components/ui';
import {
  listarPrecios,
  guardarPrecio,
  type ProductoPrecio,
} from '../services/inventoryProductsApi';
export default function InvoicePricesPage() {
  const [productos, setProductos] = useState<ProductoPrecio[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    listarPrecios()
      .then((p) => {
        if (vivo) setProductos(p);
      })
      .catch(() => {
        if (vivo) setMensaje('No se pudieron cargar los precios.');
      });
    return () => {
      vivo = false;
    };
  }, []);
  async function guardar(p: ProductoPrecio) {
    const precio = Number(p.salePrice);
    if (
      !Number.isFinite(precio) ||
      precio <= 0 ||
      Math.abs(precio * 100 - Math.round(precio * 100)) > 0.000001
    ) {
      setMensaje(
        'Ingrese un precio de venta positivo, con un máximo de dos decimales.',
      );
      return;
    }
    setGuardando(p.sku);
    setMensaje('');
    try {
      await guardarPrecio(p.sku, precio);
      setMensaje(`Precio guardado: ${p.sku}`);
    } catch {
      setMensaje(`No se pudo guardar el precio de ${p.sku}.`);
    } finally {
      setGuardando(null);
    }
  }
  return (
    <Page>
      <PageHeader
        title="Precios de venta"
        description="PEN · Precio unitario final con IGV incluido. Sin precio configurado, el producto no se ofrece para emisión."
      />
      {mensaje && <p role="status">{mensaje}</p>}
      <table className="w-full border-separate border-spacing-3 text-left text-sm">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio final (S/)</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.sku}>
              <td>
                {p.sku} — {p.description}
              </td>
              <td>
                <input
                  className="w-36 rounded-md border border-input bg-background px-3 py-2 text-right"
                  aria-label={`Precio de ${p.sku}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={p.salePrice ?? ''}
                  onChange={(e) =>
                    setProductos((prev) =>
                      prev.map((x) =>
                        x.sku === p.sku
                          ? { ...x, salePrice: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <Button
                  disabled={guardando !== null}
                  onClick={() => void guardar(p)}
                >
                  {guardando === p.sku ? 'Guardando…' : 'Guardar'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
