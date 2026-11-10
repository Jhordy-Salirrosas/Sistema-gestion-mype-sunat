import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { masterDataApi, type BusinessPartnerRecord, type PartnerRole } from '../services/masterDataApi';
import { enqueuePartnerCreate } from '@/lib/outbox';

export const PARTNER_ROLES: PartnerRole[] = ['CLIENTE', 'PROVEEDOR', 'IMPORTADOR', 'AGENTE', 'TRANSPORTISTA'];
export const partnerApiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  return Array.isArray(message) ? message.join(' · ') : typeof message === 'string' ? message : err.message || 'No se pudo procesar la solicitud.';
};

interface Props {
  onClose: () => void;
  onSaved?: (partner: BusinessPartnerRecord) => void;
  partner?: BusinessPartnerRecord;
  initialRole?: PartnerRole;
  requiredRole?: PartnerRole;
  initialDocument?: string;
  initialName?: string;
  allowOffline?: boolean;
}

/** Mounted only while open, so every opening starts with the current partner/defaults. */
export function PartnerFormDialog({ onClose, onSaved, partner, initialRole = 'PROVEEDOR', requiredRole, initialDocument = '', initialName = '', allowOffline = false }: Props) {
  const numeroRef = useRef<HTMLInputElement>(null), nombreRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    docType: partner?.doc_type ?? (initialDocument.length === 8 ? '1' : '6'),
    docNumber: partner?.doc_number ?? initialDocument,
    legalName: partner?.legal_name ?? initialName,
    tradeName: partner?.trade_name ?? '', countryCode: partner?.country_code ?? 'PE',
    address: partner?.address ?? '', email: partner?.email ?? '', phone: partner?.phone ?? '',
    paymentTerms: partner?.payment_terms ?? 'CONTADO', currencyCode: partner?.currency_code ?? 'PEN',
    hasCredit: typeof partner?.has_credit === 'boolean' ? partner.has_credit : Boolean(partner?.payment_terms && partner.payment_terms !== 'CONTADO'),
    allowsDiscount: typeof partner?.allows_discount === 'boolean' ? partner.allows_discount : false,
    isActive: partner?.is_active ?? true,
  });
  const [roles, setRoles] = useState<PartnerRole[]>(partner ? [...partner.roles] : [initialRole]);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<BusinessPartnerRecord | null>(null);
  const toggleRole = (role: PartnerRole) => setRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  const save = useMutation({
    mutationFn: async (addRole: boolean) => {
      if (addRole && existing && requiredRole) {
        // Re-read immediately before the PUT to retain all current roles.
        const current = await masterDataApi.getPartner(existing.id);
        if (!current.is_active) throw new Error('El tercero está inactivo. Solicite su revisión en el maestro.');
        return masterDataApi.updatePartner(current.id, { roles: [...new Set([...current.roles, requiredRole])] });
      }
      const payload = {
        legalName: form.legalName.trim(), tradeName: form.tradeName.trim() || undefined,
        countryCode: form.countryCode.trim().toUpperCase(), address: form.address.trim() || undefined,
        email: form.email.trim() || undefined, phone: form.phone.trim() || undefined,
        paymentTerms: form.paymentTerms, hasCredit: form.hasCredit, allowsDiscount: form.allowsDiscount, currencyCode: form.currencyCode, roles,
      };
      if (partner) return masterDataApi.updatePartner(partner.id, { ...payload, isActive: form.isActive });
      if (requiredRole) {
        const matches = await masterDataApi.getPartners({ q: form.docNumber.trim() });
        const match = matches.find((p) => p.doc_type === form.docType && p.doc_number === form.docNumber.trim());
        if (match) {
          if (!match.is_active) throw new Error('El tercero está inactivo. Solicite su revisión en el maestro.');
          if (match.roles.includes(requiredRole)) return match;
          setExisting(match);
          return null;
        }
      }
      const createPayload = { ...payload, docType: form.docType, docNumber: form.docNumber.trim() };
      try { return await masterDataApi.createPartner(createPayload); }
      catch (error) {
        const sinRespuesta = !navigator.onLine || (error instanceof Error && 'response' in error && !(error as { response?: unknown }).response);
        if (allowOffline && sinRespuesta) {
          await enqueuePartnerCreate(createPayload);
          return { offline: true } as const;
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      if (!data) return;
      void queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
      void queryClient.invalidateQueries({ queryKey: ['master-data', 'partner'] });
      void queryClient.invalidateQueries({ queryKey: ['master-data', 'partner-tax-status'] });
      if ('offline' in data) { window.alert('Sin conexión: el tercero quedó en cola y se enviará al reconectar.'); }
      else onSaved?.(data);
      onClose();
    },
    onError: (e) => setError(partnerApiError(e)),
  });
  return <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
    <DialogContent onOpenAutoFocus={e => { const field = !form.docNumber.trim() ? numeroRef.current : !form.legalName.trim() ? nombreRef.current : null; if (field) { e.preventDefault(); field.focus(); } }} className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{partner ? 'Editar cliente / proveedor' : 'Nuevo cliente / proveedor'}</DialogTitle></DialogHeader>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {existing ? <div>
        <p>El documento ya pertenece a {existing.legal_name}. Puede añadir el rol {requiredRole} conservando sus demás roles.</p>
        <Button disabled={save.isPending} onClick={() => save.mutate(true)}>Añadir rol {requiredRole}</Button>
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancelar</Button>
      </div> : <>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium">Tipo de documento</p>
              <select aria-label="Tipo de documento" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={!!partner} value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                <option value="6">RUC (Registro Único de Contribuyente)</option>
                <option value="1">DNI (Documento Nacional de Identidad)</option>
                <option value="4">Carné de extranjería</option>
                <option value="0">TAX ID / Documento Extranjero</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-medium">Número <span aria-hidden="true">*</span></p>
              <Input ref={numeroRef} aria-required="true" aria-invalid={!form.docNumber.trim()} aria-describedby={!form.docNumber.trim() ? "partner-numero-error" : undefined} aria-label="Número" disabled={!!partner} placeholder="Ej. 20100000001 o TAX ID" value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
              {!form.docNumber.trim() && <p id="partner-numero-error" className="text-xs text-destructive">Indique el número de documento.</p>}
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Razón social <span aria-hidden="true">*</span></p>
              <Input ref={nombreRef} aria-required="true" aria-invalid={!form.legalName.trim()} aria-describedby={!form.legalName.trim() ? "partner-nombre-error" : undefined} aria-label="Razón social" placeholder="Nombre o Razón Social oficial" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
              {!form.legalName.trim() && <p id="partner-nombre-error" className="text-xs text-destructive">Indique la razón social o nombre.</p>}
            </div>
            <div>
              <p className="mb-1 font-medium">Nombre comercial</p>
              <Input aria-label="Nombre comercial" placeholder="Nombre comercial abreviado" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">País (ISO ej. PE, CN, US)</p>
              <Input aria-label="País (ISO ej. PE, CN, US)" placeholder="PE" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">Condición de pago</p>
              <select aria-label="Condición de pago" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value, hasCredit: e.target.value !== 'CONTADO' })}>
                <option value="CONTADO">Contado</option>
                <option value="15_DIAS">15 días</option>
                <option value="30_DIAS">30 días</option>
                <option value="45_DIAS">45 días</option>
                <option value="60_DIAS">60 días</option>
                <option value="CARTA_CREDITO">Carta de crédito</option>
              </select>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label="Habilitado para venta al crédito"
                  checked={form.hasCredit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hasCredit: e.target.checked,
                      paymentTerms: e.target.checked
                        ? form.paymentTerms === 'CONTADO'
                          ? '30_DIAS'
                          : form.paymentTerms
                        : 'CONTADO',
                    })
                  }
                />
                Habilitado para venta al crédito
              </label>
              <label className="mt-1.5 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label="Admite descuento en ventas"
                  checked={form.allowsDiscount}
                  onChange={(e) =>
                    setForm({ ...form, allowsDiscount: e.target.checked })
                  }
                />
                Admite descuento en ventas
              </label>
            </div>
            <div>
              <p className="mb-1 font-medium">Moneda</p>
              <select aria-label="Moneda" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
                <option value="EUR">EUR (Euros)</option>
                <option value="CNY">CNY (Yuanes)</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-medium">Email de contacto</p>
              <Input aria-label="Email de contacto" placeholder="contacto@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 font-medium">Teléfono</p>
              <Input aria-label="Teléfono" placeholder="+51 999 888 777" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Dirección fiscal / operativa</p>
              <Input aria-label="Dirección fiscal / operativa" placeholder="Av. Principal 123, Ciudad, País" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-medium">Roles asignados <span aria-hidden="true">*</span></p>
              <div role="group" aria-label="Roles asignados" aria-required="true" aria-invalid={!roles.length} aria-describedby={!roles.length ? "partner-roles-error" : undefined} className="flex flex-wrap gap-2">
                {!roles.length && <p id="partner-roles-error" className="text-xs text-destructive">Seleccione al menos un rol.</p>}
                {PARTNER_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" disabled={requiredRole === r} checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            {partner && <label>Estado<select aria-label="Estado" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}><option value="1">Activo</option><option value="0">Inactivo</option></select></label>}
          </div>

      <DialogFooter>
        <Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancelar</Button>
        <Button disabled={save.isPending || !form.docNumber.trim() || !form.legalName.trim() || !roles.length} onClick={() => { setError(''); save.mutate(false); }}>{partner ? 'Guardar cambios' : 'Guardar tercero'}</Button>
      </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
