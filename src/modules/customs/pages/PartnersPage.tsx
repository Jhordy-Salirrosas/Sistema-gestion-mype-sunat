import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Page,
  PageHeader,
  Button,
  Badge,
  Card,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';
import { Building2, Plus, RefreshCw, Search, Save, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { masterDataApi, type BusinessPartnerRecord, type PartnerRole } from '../services/masterDataApi';
import { enqueuePartnerCreate } from '@/lib/outbox';
import { PartnerDetailDrawer } from '../components/PartnerDetailDrawer';

const ROLES: PartnerRole[] = ['CLIENTE', 'PROVEEDOR', 'IMPORTADOR', 'AGENTE', 'TRANSPORTISTA'];

const apiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string') return message;
  return err.message || 'No se pudo procesar la solicitud.';
};

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartnerRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulario nuevo tercero
  const [form, setForm] = useState({
    docType: '6',
    docNumber: '',
    legalName: '',
    tradeName: '',
    countryCode: 'PE',
    address: '',
    email: '',
    phone: '',
    paymentTerms: 'CONTADO',
    currencyCode: 'PEN',
  });
  const [roles, setRoles] = useState<PartnerRole[]>(['PROVEEDOR']);

  // Formulario editar tercero
  const [editForm, setEditForm] = useState<{
    legalName: string;
    tradeName: string;
    countryCode: string;
    address: string;
    email: string;
    phone: string;
    paymentTerms: string;
    currencyCode: string;
    roles: PartnerRole[];
    isActive: boolean;
  }>({
    legalName: '',
    tradeName: '',
    countryCode: 'PE',
    address: '',
    email: '',
    phone: '',
    paymentTerms: 'CONTADO',
    currencyCode: 'PEN',
    roles: ['PROVEEDOR'],
    isActive: true,
  });

  const partners = useQuery<BusinessPartnerRecord[]>({
    queryKey: ['master-data', 'partners', role, search],
    queryFn: () =>
      masterDataApi.getPartners({
        role: role === 'ALL' ? undefined : role,
        q: search.trim() || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        docType: form.docType,
        docNumber: form.docNumber.trim(),
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim() || undefined,
        countryCode: form.countryCode.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        paymentTerms: form.paymentTerms,
        currencyCode: form.currencyCode,
        roles,
      };
      try {
        return await masterDataApi.createPartner(payload);
      } catch (error) {
        const sinRespuesta =
          !navigator.onLine ||
          (error instanceof Error && 'response' in error && !(error as { response?: unknown }).response);
        if (sinRespuesta) {
          await enqueuePartnerCreate(payload);
          return { offline: true } as const;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
      setIsNewOpen(false);
      setError(data && 'offline' in data ? 'Sin conexión: el cliente quedó en cola y se enviará al reconectar.' : null);
      setForm({
        docType: '6',
        docNumber: '',
        legalName: '',
        tradeName: '',
        countryCode: 'PE',
        address: '',
        email: '',
        phone: '',
        paymentTerms: 'CONTADO',
        currencyCode: 'PEN',
      });
      setRoles(['PROVEEDOR']);
    },
    onError: (e) => setError(apiError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingPartner) throw new Error('No hay tercero seleccionado para editar');
      return masterDataApi.updatePartner(editingPartner.id, {
        legalName: editForm.legalName.trim(),
        tradeName: editForm.tradeName.trim() || undefined,
        countryCode: editForm.countryCode.trim().toUpperCase(),
        address: editForm.address.trim() || undefined,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        paymentTerms: editForm.paymentTerms,
        currencyCode: editForm.currencyCode,
        roles: editForm.roles,
        isActive: editForm.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
      setEditingPartner(null);
      setError(null);
    },
    onError: (e) => setError(apiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => masterDataApi.deletePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
    },
    onError: (e) => alert(apiError(e)),
  });

  const toggleRole = (value: PartnerRole) => {
    setRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  };

  const toggleEditRole = (value: PartnerRole) => {
    setEditForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(value)
        ? prev.roles.filter((r) => r !== value)
        : [...prev.roles, value],
    }));
  };

  const startEdit = (p: BusinessPartnerRecord) => {
    setError(null);
    setEditingPartner(p);
    setEditForm({
      legalName: p.legal_name || '',
      tradeName: p.trade_name || '',
      countryCode: p.country_code || 'PE',
      address: p.address || '',
      email: p.email || '',
      phone: p.phone || '',
      paymentTerms: p.payment_terms || 'CONTADO',
      currencyCode: p.currency_code || 'PEN',
      roles: [...p.roles],
      isActive: p.is_active ?? true,
    });
  };

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
        <Button size="sm" onClick={() => { setError(null); setIsNewOpen(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nuevo tercero
        </Button>
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
                  <td className="p-3">{p.payment_terms || '—'}</td>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar tercero"
                        onClick={() => startEdit(p)}
                        className="h-8 w-8 p-0 text-primary hover:text-primary/80"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Eliminar tercero"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(p)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <PartnerDetailDrawer partnerId={selectedId} onClose={() => setSelectedId(null)} />

      {/* Modal Nuevo Tercero */}
      <Dialog open={isNewOpen} onOpenChange={(open) => !open && setIsNewOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Nuevo cliente / proveedor
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium">Tipo de documento</p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                <option value="6">RUC (Registro Único de Contribuyente)</option>
                <option value="1">DNI (Documento Nacional de Identidad)</option>
                <option value="4">Carné de extranjería</option>
                <option value="0">TAX ID / Documento Extranjero</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-medium">Número</p>
              <Input placeholder="Ej. 20100000001 o TAX ID" value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Razón social</p>
              <Input placeholder="Nombre o Razón Social oficial" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">Nombre comercial</p>
              <Input placeholder="Nombre comercial abreviado" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">País (ISO ej. PE, CN, US)</p>
              <Input placeholder="PE" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">Condición de pago</p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
                <option value="CONTADO">Contado</option>
                <option value="15_DIAS">15 días</option>
                <option value="30_DIAS">30 días</option>
                <option value="45_DIAS">45 días</option>
                <option value="60_DIAS">60 días</option>
                <option value="CARTA_CREDITO">Carta de crédito</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-medium">Moneda</p>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
                <option value="EUR">EUR (Euros)</option>
                <option value="CNY">CNY (Yuanes)</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-medium">Email de contacto</p>
              <Input placeholder="contacto@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">Teléfono</p>
              <Input placeholder="+51 999 888 777" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Dirección fiscal / operativa</p>
              <Input placeholder="Av. Principal 123, Ciudad, País" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Roles asignados</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.docNumber || !form.legalName || roles.length === 0}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar tercero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Tercero */}
      <Dialog open={!!editingPartner} onOpenChange={(open) => !open && setEditingPartner(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              Editar cliente / proveedor
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {editingPartner && (
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Documento (No editable)</p>
                <Input value={`${editingPartner.doc_type} - ${editingPartner.doc_number}`} disabled className="bg-muted/40 font-mono" />
              </div>
              <div>
                <p className="mb-1 font-medium">País (ISO ej. PE, CN, US)</p>
                <Input value={editForm.countryCode} onChange={(e) => setEditForm({ ...editForm, countryCode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 font-medium">Razón social *</p>
                <Input value={editForm.legalName} onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })} />
              </div>
              <div>
                <p className="mb-1 font-medium">Nombre comercial</p>
                <Input value={editForm.tradeName} onChange={(e) => setEditForm({ ...editForm, tradeName: e.target.value })} />
              </div>
              <div>
                <p className="mb-1 font-medium">Condición de pago</p>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.paymentTerms} onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}>
                  <option value="CONTADO">Contado</option>
                  <option value="15_DIAS">15 días</option>
                  <option value="30_DIAS">30 días</option>
                  <option value="45_DIAS">45 días</option>
                  <option value="60_DIAS">60 días</option>
                  <option value="CARTA_CREDITO">Carta de crédito</option>
                </select>
              </div>
              <div>
                <p className="mb-1 font-medium">Moneda habitual</p>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.currencyCode} onChange={(e) => setEditForm({ ...editForm, currencyCode: e.target.value })}>
                  <option value="PEN">PEN (Soles)</option>
                  <option value="USD">USD (Dólares)</option>
                  <option value="EUR">EUR (Euros)</option>
                  <option value="CNY">CNY (Yuanes)</option>
                </select>
              </div>
              <div>
                <p className="mb-1 font-medium">Estado</p>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editForm.isActive ? '1' : '0'}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === '1' })}
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>
              <div>
                <p className="mb-1 font-medium">Email</p>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <p className="mb-1 font-medium">Teléfono</p>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 font-medium">Dirección fiscal / operativa</p>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 font-medium">Roles asignados</p>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs cursor-pointer hover:bg-muted/40">
                      <input type="checkbox" checked={editForm.roles.includes(r)} onChange={() => toggleEditRole(r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPartner(null)}>Cancelar</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editForm.legalName || editForm.roles.length === 0}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
