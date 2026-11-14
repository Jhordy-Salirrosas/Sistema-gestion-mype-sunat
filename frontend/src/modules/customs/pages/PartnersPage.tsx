import { etiquetaCondicionPago } from '../lib/paymentTerms';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Page, PageHeader, Button, Badge, Card, Input } from '@/components/ui';
import { Plus, RefreshCw, Search, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { masterDataApi, type BusinessPartnerRecord } from '../services/masterDataApi';
import { PartnerDetailDrawer } from '../components/PartnerDetailDrawer';
import { PartnerFormDialog, PARTNER_ROLES as ROLES, partnerApiError } from '../components/PartnerFormDialog';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export default function PartnersPage({ context = 'customs' }: { context?: 'customs' | 'billing' }) {
  const billing = context === 'billing';
  const { canEmitInvoices } = useRolePermissions();
  const canWrite = !billing || canEmitInvoices;
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>(billing ? 'CLIENTE' : 'ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartnerRecord | null>(null);
  const partners = useQuery<BusinessPartnerRecord[]>({
    queryKey: ['master-data', 'partners', role, search],
    queryFn: () => masterDataApi.getPartners({ role: role === 'ALL' ? undefined : role, q: search.trim() || undefined }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => masterDataApi.deletePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
    },
    onError: (e) => alert(partnerApiError(e)),
  });

  const handleDelete = (p: BusinessPartnerRecord) => {
    if (window.confirm(`¿Está seguro de eliminar a "${p.legal_name}" (${p.doc_number})? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(p.id);
    }
  };

  const refresh = () => partners.refetch();

  return (
    <Page>
      <PageHeader
        title="Clientes y proveedores"
        description="Maestro único de terceros: datos fiscales, contactos, direcciones y cuentas bancarias."
      >
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
        {canWrite && <Button size="sm" onClick={() => setIsNewOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nuevo tercero
        </Button>}
      </PageHeader>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 text-sm"
            placeholder="Buscar por RUC, razón social o nombre comercial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['ALL', ...ROLES] as string[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r ? 'default' : 'outline'}
              onClick={() => setRole(r)}
              className="h-8 text-xs"
            >
              {r === 'ALL' ? 'Todos' : r}
            </Button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground uppercase">
            <tr>
              <th className="p-3">Documento</th>
              <th className="p-3">Razón social</th>
              <th className="p-3">País</th>
              <th className="p-3">Roles</th>
              <th className="p-3">Pago</th>
              <th className="p-3">Contacto</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {partners.isLoading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando terceros...</td></tr>
            ) : (partners.data ?? []).length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No hay terceros registrados.</td></tr>
            ) : (
              (partners.data ?? []).map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="p-3 font-mono font-medium">{p.doc_type} - {p.doc_number}</td>
                  <td className="p-3">
                    <p className="font-semibold text-foreground">{p.legal_name}</p>
                    {p.trade_name && <p className="text-[11px] text-muted-foreground">{p.trade_name}</p>}
                  </td>
                  <td className="p-3">{p.country_code}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((r) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3">
                    {p.has_credit === true || (p.has_credit == null && Boolean(p.payment_terms && p.payment_terms !== 'CONTADO'))
                      ? `Crédito (${etiquetaCondicionPago(p.payment_terms, 'Habilitado')})`
                      : etiquetaCondicionPago(p.payment_terms)}
                    {p.allows_discount === true ? ' · Con desc.' : ''}
                  </td>
                  <td className="p-3">{p.email || p.phone || '—'}</td>
                  <td className="p-3 text-center">
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver ficha técnica y cuentas"
                        onClick={() => setSelectedId(p.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {canWrite && <Button
                        variant="ghost"
                        size="sm"
                        title="Editar tercero"
                        onClick={() => setEditingPartner(p)}
                        className="h-8 w-8 p-0 text-primary hover:text-primary/80"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>}
                      {!billing && <Button
                        variant="ghost"
                        size="sm"
                        title="Eliminar tercero"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(p)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <PartnerDetailDrawer partnerId={selectedId} onClose={() => setSelectedId(null)} readOnly={!canWrite} />


      {canWrite && isNewOpen && <PartnerFormDialog onClose={() => setIsNewOpen(false)} enableRucLookup={billing} initialRole={billing ? 'CLIENTE' : 'PROVEEDOR'} allowOffline={!billing} />}
      {canWrite && editingPartner && <PartnerFormDialog partner={editingPartner} onClose={() => setEditingPartner(null)} />}
    </Page>
  );
}
