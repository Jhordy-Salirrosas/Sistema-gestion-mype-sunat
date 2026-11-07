import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Button, Card, Badge, FilterBar, FilterSearch } from '@/components/ui';
import { PlusCircle, RefreshCw, Eye, CheckCircle2, AlertTriangle, ShieldAlert, ArrowRight, CreditCard, Ship } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { type CustomsDeclarationRecord, type CustomsChannel } from '../types';
import { DamFormatsViewerModal } from '../components/DamFormatsViewerModal';
import { customsDeclarationsApi } from '../services/customsDeclarationsApi';
import { useQuery } from '@tanstack/react-query';

const formatNumerationDate = (dateVal: string | undefined) => {
  if (!dateVal) return '26 oct. 2026, 10:30 a. m.';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateVal;
  }
};

export default function DeclarationsListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [selectedDam, setSelectedDam] = useState<CustomsDeclarationRecord | null>(null);

  const { data: declarations = [], refetch } = useQuery<CustomsDeclarationRecord[]>({
    queryKey: ['customs-declarations-list'],
    queryFn: async () => {
      const res = await customsDeclarationsApi.getDeclarations();
      return Array.isArray(res) ? res : [];
    },
  });

  const filteredDams = declarations.filter((d) => {
    const term = (searchTerm || '').trim().toLowerCase();
    const duaNumber = String(d.dua_number || (d as any).duaNumber || '').toLowerCase();
    const shipmentId = String(d.shipment_id || (d as any).shipmentId || '').toLowerCase();
    const matchesSearch = !term || duaNumber.includes(term) || shipmentId.includes(term);
    const matchesChannel = channelFilter === 'ALL' || d.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const activeDam = filteredDams[0] || declarations[0] || null;
  const totalCdaDeudaPen = activeDam
    ? (activeDam.total_ad_valorem_pen || 0) +
      (activeDam.total_igv_pen || 0) +
      (activeDam.total_ipm_pen || 0) +
      (activeDam.total_perception_pen || 0)
    : 0;

  const getChannelBadge = (ch: CustomsChannel) => {
    switch (ch) {
      case 'VERDE':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Verde (Levante Inmediato)
          </Badge>
        );
      case 'NARANJA':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" /> Naranja (Doc. Aduanas)
          </Badge>
        );
      case 'ROJO':
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1 text-[10px]">
            <ShieldAlert className="h-3 w-3" /> Rojo (Aforo Físico)
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">Pendiente</Badge>;
    }
  };

  return (
    <Page>
      <PageHeader
        title="3. Despacho y Declaración Aduanera (DAM / DUA)"
        description="Gestión oficial de declaraciones aduaneras (DUA/DAM), asignación de canales de control SUNAT, formatos oficiales A, B y C, y liquidación de tributos (CDA)."
      >
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs gap-1.5 h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(activeDam?.shipment_id ? `/customs/declarations/new?shipmentId=${activeDam.shipment_id}` : '/customs/declarations/new')}
            className="text-xs gap-1.5 h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            + Numerar DAM (desde Expediente)
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        {/* Banner de Estado Oficial SUNAT - Expediente Activo o Estado Inicial */}
        {activeDam ? (
          <Card className="p-4 border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-background to-background">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Canal {activeDam.channel} — {activeDam.channel === 'VERDE' ? 'Levante Inmediato Autorizado' : 'En Control SUNAT'}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-foreground">
                    DAM Oficial: {activeDam.dua_number}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    Expediente: <strong className="text-foreground">{activeDam.shipment_id}</strong>
                  </span>
                </div>

                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><strong>Proveedor:</strong> {activeDam.supplier_name || 'Proveedor Registrado'}</span>
                  <span><strong>Transporte:</strong> {activeDam.transport_doc_number || 'B/L Registrado'}</span>
                  <span><strong>Mercancía:</strong> {activeDam.series?.[0]?.commercial_description || 'Mercancía Declarada'}</span>
                  <span><strong>Valor CIF:</strong> <strong className="text-foreground font-mono">{formatCurrency(activeDam.cif_total_usd, 'USD')}</strong></span>
                  <span><strong>Deuda CDA:</strong> <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{formatCurrency(totalCdaDeudaPen, 'PEN')}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDam(activeDam)}
                  className="text-xs gap-1.5 h-8 font-semibold text-primary"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Formatos A / B / C
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/customs/landed-cost')}
                  className="text-xs gap-1.5 h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Continuar a Paso 4: Recojo y Almacén
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center border-dashed">
            <h3 className="text-sm font-semibold text-foreground">No hay declaraciones DAM registradas</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Las declaraciones aduaneras (Formatos A, B y C) se generan en este Paso 3 una vez completado el embarque en el Paso 2.
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/customs/declarations/new')}
              className="mt-3 text-xs gap-1.5 font-semibold"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Numerar Nueva Declaración DAM
            </Button>
          </Card>
        )}

        {/* Barra de Filtros */}
        <FilterBar>
          <FilterSearch
            placeholder="Buscar por N° DAM (ej. 118-2026-10-...) o Expediente..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="max-w-md"
          />
          <div className="flex gap-1.5 ml-auto text-xs">
            {['ALL', 'VERDE', 'NARANJA', 'ROJO'].map((ch) => (
              <Button
                key={ch}
                size="sm"
                variant={channelFilter === ch ? 'default' : 'ghost'}
                onClick={() => setChannelFilter(ch)}
                className="h-8 text-xs px-2.5"
              >
                {ch === 'ALL' ? 'Todos los Canales' : ch}
              </Button>
            ))}
          </div>
        </FilterBar>

        {/* Tabla de DAMs */}
        <Card className="p-0 overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-[11px] font-semibold text-muted-foreground border-b uppercase tracking-wider">
                <tr>
                  <th className="p-3">N° DAM Oficial</th>
                  <th className="p-3">Expediente / Ref.</th>
                  <th className="p-3">Modalidad</th>
                  <th className="p-3">Fecha Numeración</th>
                  <th className="p-3">Canal SUNAT</th>
                  <th className="p-3 text-right">CIF (USD)</th>
                  <th className="p-3 text-right">Deuda CDA (PEN)</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDams.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground">
                      No se encontraron declaraciones aduaneras registradas.
                    </td>
                  </tr>
                ) : (
                  filteredDams.map((dam) => {
                    const totalTaxPen = (dam.total_ad_valorem_pen || 0) + (dam.total_igv_pen || 0) + (dam.total_ipm_pen || 0) + (dam.total_perception_pen || 0);
                    return (
                      <tr key={dam.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-primary block">{dam.dua_number}</span>
                          <span className="text-[10px] text-muted-foreground">Aduana {dam.customs_code || '118'} · Régimen {dam.regime_code || '10'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-semibold block">{dam.shipment_id}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Ship className="h-3 w-3" /> {dam.transport_doc_number || 'B/L'}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {dam.dispatch_mode === '10' ? 'Anticipado 01' : 'Diferido 02'}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">
                          {formatNumerationDate(dam.numeration_date)}
                        </td>
                        <td className="p-3">{getChannelBadge(dam.channel)}</td>
                        <td className="p-3 text-right font-mono font-bold">
                          {formatCurrency(dam.cif_total_usd, 'USD')}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(totalTaxPen, 'PEN')}
                          {totalTaxPen > 0 && (
                            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                              CDA {(dam as any).cda_number || `CDA-${dam.correlative_number || 'SUNAT'}`}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDam(dam)}
                              className="h-7 text-[11px] gap-1 px-2 text-primary"
                            >
                              <Eye className="h-3 w-3" />
                              Formatos A/B/C
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate('/customs/settlements')}
                              className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <CreditCard className="h-3 w-3" />
                              Ver CDA
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <DamFormatsViewerModal
        declaration={selectedDam}
        isOpen={Boolean(selectedDam)}
        onClose={() => setSelectedDam(null)}
      />
    </Page>
  );
}
