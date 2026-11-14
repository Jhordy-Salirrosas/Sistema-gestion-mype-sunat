import { errorRegistroTercero } from '../lib/partnerRecordValidation';
import { resumenTercero } from '../lib/partnerSummary';
import { etiquetaCondicionPago } from '../lib/paymentTerms';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';
import { Building2, CreditCard, Mail, MapPin, Phone, User } from 'lucide-react';
import { masterDataApi, type PartnerDetailRecord } from '../services/masterDataApi';

type Tab = 'GENERAL' | 'ADDRESSES' | 'CONTACTS' | 'BANKS';

interface Props {
  partnerId: string | null;
  onClose: () => void;
  readOnly?: boolean;
}

const apiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string') return message;
  return err.message || 'No se pudo guardar.';
};

export function PartnerDetailDrawer({ partnerId, onClose, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('GENERAL');
  const [error, setError] = useState<string | null>(null);

  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editingBank, setEditingBank] = useState<string | null>(null);
  const [address, setAddress] = useState({ label: 'PRINCIPAL', address: '', city: '' });
  const [contact, setContact] = useState({ name: '', position: '', email: '', phone: '' });
  const [bank, setBank] = useState({
    bankName: '',
    accountNumber: '',
    cci: '',
    swift: '',
    currencyCode: 'USD', bankCountry: 'PE',
  });

  const detail = useQuery<PartnerDetailRecord>({
    queryKey: ['master-data', 'partner', partnerId],
    queryFn: () => masterDataApi.getPartner(partnerId as string),
    enabled: Boolean(partnerId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['master-data', 'partner', partnerId] });
    queryClient.invalidateQueries({ queryKey: ['master-data', 'partners'] });
  };

  const statusMutation = useMutation({
    mutationFn: () => masterDataApi.updatePartner(partnerId as string, { isActive: !detail.data?.is_active }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e) => setError(apiError(e)),
  });

  const addressError = errorRegistroTercero('addresses', address);
  const contactError = errorRegistroTercero('contacts', contact);
  const bankError = errorRegistroTercero('bank-accounts', bank);
  const removeMutation = useMutation({
    mutationFn: ({kind,id}: {kind:string;id:string}) => masterDataApi.deletePartnerRecord(partnerId as string, kind, id),
    onSuccess: () => { invalidate(); setError(null); }, onError: (e) => setError(apiError(e)),
  });
  const remove = (kind:string, id:string) => { if(window.confirm('¿Eliminar este registro del tercero?')) removeMutation.mutate({kind,id}); };

  const addressMutation = useMutation({
    mutationFn: () => editingAddress ? masterDataApi.updatePartnerRecord(partnerId as string, 'addresses', editingAddress, address) : masterDataApi.addAddress(partnerId as string, address),
    onSuccess: () => {
      invalidate();
      setEditingAddress(null);
      setAddress({ label: 'PRINCIPAL', address: '', city: '' });
      setError(null);
    },
    onError: (e) => setError(apiError(e)),
  });

  const contactMutation = useMutation({
    mutationFn: () => {
      const payload = {...contact, email:contact.email.trim() || null, phone:contact.phone.trim() || null};
      return editingContact ? masterDataApi.updatePartnerRecord(partnerId as string, 'contacts', editingContact, payload) : masterDataApi.addContact(partnerId as string, payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingContact(null);
      setContact({ name: '', position: '', email: '', phone: '' });
      setError(null);
    },
    onError: (e) => setError(apiError(e)),
  });

  const bankMutation = useMutation({
    mutationFn: () => editingBank ? masterDataApi.updatePartnerRecord(partnerId as string, 'bank-accounts', editingBank, bank) : masterDataApi.addBankAccount(partnerId as string, bank),
    onSuccess: () => {
      invalidate();
      setEditingBank(null);
      setBank({ bankName: '', accountNumber: '', cci: '', swift: '', currencyCode: 'USD', bankCountry:'PE' });
      setError(null);
    },
    onError: (e) => setError(apiError(e)),
  });

  const p = detail.data;
  const summary = p ? resumenTercero(p) : null;

  return (
    <Dialog open={Boolean(partnerId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {p?.legal_name ?? 'Cargando tercero...'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {detail.isLoading && <p className="text-xs text-muted-foreground">Cargando ficha...</p>}

        {p && (
          <>
            <div className="flex flex-wrap gap-1">
              {p.roles.map((role) => (
                <Badge key={role} variant="outline" className="text-[10px]">{role}</Badge>
              ))}
              <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {p.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
              {!readOnly && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate()}>{statusMutation.isPending ? 'Guardando estado…' : p.is_active ? 'Inactivar tercero' : 'Activar tercero'}</Button>}
            </div>

            <div className="flex gap-1 border-b pb-2">
              {([
                ['GENERAL', 'General'],
                ['ADDRESSES', 'Direcciones'],
                ['CONTACTS', 'Contactos'],
                ['BANKS', 'Bancos'],
              ] as Array<[Tab, string]>).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={tab === key ? 'default' : 'ghost'}
                  onClick={() => setTab(key)}
                  className="text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>

            {tab === 'GENERAL' && (
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div><p className="text-muted-foreground">Documento</p><p className="font-mono font-semibold">{p.doc_type} - {p.doc_number}</p></div>
                <div><p className="text-muted-foreground">País</p><p className="font-semibold">{p.country_code}</p></div>
                <div><p className="text-muted-foreground">Condición de pago</p><p className="font-semibold">{etiquetaCondicionPago(p.payment_terms, 'No definida')}</p></div>
                <div><p className="text-muted-foreground">Moneda</p><p className="font-semibold">{p.currency_code || 'PEN'}</p></div>
                <div className="flex items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{summary?.email || 'Sin correo'}</span></div>
                <div className="flex items-start gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{summary?.phone || 'Sin teléfono'}</span></div>
                <div className="sm:col-span-2 flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><span>{summary?.address || 'Sin dirección'}</span></div>
              </div>
            )}

            {tab === 'ADDRESSES' && (
              <div className="space-y-3 text-xs">
                {p.addresses.length === 0 && <p className="text-muted-foreground">Sin direcciones registradas.</p>}
                {p.addresses.map((a) => (
                  <div key={a.id} className="rounded-md border p-2">
                    <p className="font-semibold">{a.label} {a.is_default && <Badge variant="secondary" className="ml-1 text-[10px]">Principal</Badge>}</p>
                    <p>{a.address}</p>
                    {!readOnly && <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => {setEditingAddress(a.id);setAddress({label:a.label,address:a.address,city:a.city??''});}}>Editar dirección</Button><Button size="sm" variant="ghost" disabled={removeMutation.isPending} onClick={() => remove('addresses',a.id)}>Eliminar dirección</Button></div>}
                    <p className="text-muted-foreground">{[a.city, a.state, a.country_code].filter(Boolean).join(', ')}</p>
                  </div>
                ))}
                {!readOnly && <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <Input placeholder="Etiqueta" value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} />
                  <Input placeholder="Ciudad" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                  <Input className="col-span-2" placeholder="Dirección" value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} />
                  {addressError && address.address && <p role="alert" className="col-span-2 text-destructive">{addressError}</p>}{editingAddress && <Button size="sm" variant="ghost" onClick={() => {setEditingAddress(null);setAddress({label:'PRINCIPAL',address:'',city:''});}}>Cancelar edición</Button>}<Button size="sm" className="col-span-2" disabled={Boolean(addressError) || addressMutation.isPending} onClick={() => addressMutation.mutate()}>
                    {editingAddress ? 'Guardar dirección' : 'Agregar dirección'}
                  </Button>
                </div>}
              </div>
            )}

            {tab === 'CONTACTS' && (
              <div className="space-y-3 text-xs">
                {p.contacts.length === 0 && <p className="text-muted-foreground">Sin contactos registrados.</p>}
                {p.contacts.map((c) => (
                  <div key={c.id} className="rounded-md border p-2">
                    <p className="flex items-center gap-1 font-semibold"><User className="h-3 w-3" /> {c.name} {c.is_primary && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}</p>
                    {!readOnly && <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => {setEditingContact(c.id);setContact({name:c.name,position:c.position??'',email:c.email??'',phone:c.phone??''});}}>Editar contacto</Button><Button size="sm" variant="ghost" disabled={removeMutation.isPending} onClick={() => remove('contacts',c.id)}>Eliminar contacto</Button></div>}
                    <p className="text-muted-foreground">{c.position || 'Sin cargo'} · {c.email || 'Sin correo'} · {c.phone || 'Sin teléfono'}</p>
                  </div>
                ))}
                {!readOnly && <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <Input placeholder="Nombre" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                  <Input placeholder="Cargo" value={contact.position} onChange={(e) => setContact({ ...contact, position: e.target.value })} />
                  <Input placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  <Input placeholder="Teléfono" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                  {contactError && contact.name && <p role="alert" className="col-span-2 text-destructive">{contactError}</p>}{editingContact && <Button size="sm" variant="ghost" onClick={() => {setEditingContact(null);setContact({name:'',position:'',email:'',phone:''});}}>Cancelar edición</Button>}<Button size="sm" className="col-span-2" disabled={Boolean(contactError) || contactMutation.isPending} onClick={() => contactMutation.mutate()}>
                    {editingContact ? 'Guardar contacto' : 'Agregar contacto'}
                  </Button>
                </div>}
              </div>
            )}

            {tab === 'BANKS' && (
              <div className="space-y-3 text-xs">
                {p.bank_accounts.length === 0 && <p className="text-muted-foreground">Sin cuentas bancarias registradas.</p>}
                {p.bank_accounts.map((b) => (
                  <div key={b.id} className="rounded-md border p-2">
                    <p className="flex items-center gap-1 font-semibold"><CreditCard className="h-3 w-3" /> {b.bank_name} · {b.currency_code}</p>
                    <p className="font-mono">{b.account_number}</p>
                    {!readOnly && <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => {setEditingBank(b.id);setBank({bankName:b.bank_name,accountNumber:b.account_number,cci:b.cci??'',swift:b.swift??'',currencyCode:b.currency_code,bankCountry:b.bank_country??'PE'});}}>Editar cuenta</Button><Button size="sm" variant="ghost" disabled={removeMutation.isPending} onClick={() => remove('bank-accounts',b.id)}>Eliminar cuenta</Button></div>}
                    <p className="text-muted-foreground">CCI: {b.cci || '—'} · SWIFT: {b.swift || '—'}</p>
                  </div>
                ))}
                {!readOnly && <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <Input placeholder="País del banco (PE)" value={bank.bankCountry} onChange={(e) => setBank({...bank,bankCountry:e.target.value})}/><Input placeholder="Banco" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
                  <Input placeholder="Moneda (USD)" value={bank.currencyCode} onChange={(e) => setBank({ ...bank, currencyCode: e.target.value })} />
                  <Input placeholder="Número de cuenta" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
                  <Input placeholder="CCI" value={bank.cci} onChange={(e) => setBank({ ...bank, cci: e.target.value })} />
                  <Input placeholder="SWIFT" value={bank.swift} onChange={(e) => setBank({ ...bank, swift: e.target.value })} />
                  {bankError && bank.bankName && <p role="alert" className="text-destructive">{bankError}</p>}{editingBank && <Button size="sm" variant="ghost" onClick={() => {setEditingBank(null);setBank({bankName:'',accountNumber:'',cci:'',swift:'',currencyCode:'USD',bankCountry:'PE'});}}>Cancelar edición</Button>}<Button size="sm" disabled={Boolean(bankError) || bankMutation.isPending} onClick={() => bankMutation.mutate()}>
                    {editingBank ? 'Guardar cuenta' : 'Agregar cuenta'}
                  </Button>
                </div>}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
