import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, Plane, Truck, Anchor, ArrowRight, FileCheck, Clock, MapPin, ExternalLink } from 'lucide-react';
import { type CustomsShipmentSummary } from '../types';

interface ShipmentKanbanProps {
  shipments: CustomsShipmentSummary[];
  onSelectShipment: (id: string) => void;
  onNavigateToDam?: (shipmentId: string) => void;
}

interface TransitColumn {
  id: 'EN_TRANSITO' | 'ARRIBADO' | 'EN_DESPACHO';
  label: string;
  badgeLabel: string;
  description: string;
  colorClass: string;
}

const TRANSIT_COLUMNS: TransitColumn[] = [
  {
    id: 'EN_TRANSITO',
    label: '1. En Travesía Internacional',
    badgeLabel: 'En Viaje',
    description: 'Carga a bordo del buque o aeronave en ruta marítima/aérea hacia el Perú.',
    colorClass: 'border-blue-500/30 bg-blue-500/5 text-blue-500',
  },
  {
    id: 'ARRIBADO',
    label: '2. Arribado a Puerto / Aeropuerto',
    badgeLabel: 'Arribado al Callao',
    description: 'Nave atracada en muelle o aeronave aterrizada. Listo para numeración de DAM.',
    colorClass: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-500',
  },
  {
    id: 'EN_DESPACHO',
    label: '3. En Depósito Temporal / Aduana',
    badgeLabel: 'En Trámite Aduanero',
    description: 'Descargado en terminal de almacenamiento, con DAM numerada o con levante.',
    colorClass: 'border-amber-500/30 bg-amber-500/5 text-amber-500',
  },
];

export const ShipmentKanban: React.FC<ShipmentKanbanProps> = ({
  shipments,
  onSelectShipment,
  onNavigateToDam,
}) => {
  // Mapeamos los estados del backend a las 3 columnas de tránsito
  const getColumnForShipment = (status: string): 'EN_TRANSITO' | 'ARRIBADO' | 'EN_DESPACHO' => {
    if (status === 'BORRADOR' || status === 'EN_TRANSITO') return 'EN_TRANSITO';
    if (status === 'ARRIBADO') return 'ARRIBADO';
    return 'EN_DESPACHO'; // EN_DESPACHO, CON_LEVANTE, COSTEADO, CERRADO
  };

  const getTransportIcon = (mode: string) => {
    switch (mode?.toUpperCase()) {
      case 'AEREO':
        return <Plane className="h-3.5 w-3.5 text-sky-500" />;
      case 'TERRESTRE':
        return <Truck className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Ship className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Fecha por confirmar';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = clean.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {TRANSIT_COLUMNS.map((col) => {
        const items = shipments.filter((s) => getColumnForShipment(s.status) === col.id);
        return (
          <div
            key={col.id}
            className="flex flex-col bg-card rounded-xl p-3.5 border border-border/80 shadow-xs min-h-[460px]"
          >
            {/* Cabecera de Columna */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/50">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">{col.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {col.description}
                </p>
              </div>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${col.colorClass}`}>
                {items.length}
              </span>
            </div>

            {/* Listado de Tarjetas */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              {items.map((shipment) => {
                const isArrivedOrReady = col.id === 'ARRIBADO' || col.id === 'EN_DESPACHO';
                return (
                  <Card
                    key={shipment.id}
                    onClick={() => onSelectShipment(shipment.id)}
                    className="cursor-pointer hover:border-primary/60 transition-all border-border/70 shadow-xs hover:shadow-md p-3.5 bg-background/50 hover:bg-muted/20 space-y-2.5"
                  >
                    <CardContent className="p-0 space-y-2.5">
                      {/* Fila 1: N° Expediente + Incoterm + Vía */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                          {getTransportIcon(shipment.transport_mode)}
                          <span>{shipment.shipment_number}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {shipment.incoterm || 'FOB'}
                          </Badge>
                          <Badge className="text-[10px] py-0 font-medium">
                            {shipment.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {/* Proveedor y Origen */}
                      <div className="text-xs">
                        <p className="font-medium text-foreground truncate" title={shipment.supplier_name}>
                          {shipment.supplier_name || 'Shenzhen Tech Ltd (China)'}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-muted-foreground/80 shrink-0" />
                          <span>Origen: {shipment.origin_country_code || 'CN'} ➔ Aduana {shipment.destination_customs || '118 - Callao'}</span>
                        </p>
                      </div>

                      {/* Datos de Transporte: BL y ETA */}
                      <div className="bg-muted/40 p-2 rounded-md text-[11px] space-y-1 font-mono">
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>Doc. Embarque (BL/AWB):</span>
                          <span className="font-semibold text-foreground">
                            BL-{shipment.shipment_number.replace('EXP-', '')}-CN
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />
                            Arribo Estimado (ETA):
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatDate(shipment.eta_date)}
                          </span>
                        </div>
                      </div>

                      {/* Botón de Traspaso Directo al Paso 3 */}
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Ver Tracking 360°
                        </span>

                        {isArrivedOrReady && onNavigateToDam && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToDam(shipment.id);
                            }}
                            className="h-7 text-[11px] gap-1 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                          >
                            <FileCheck className="h-3 w-3" />
                            Numerar DAM (Paso 3)
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {items.length === 0 && (
                <div className="h-36 flex flex-col items-center justify-center border border-dashed border-border/60 rounded-lg p-4 text-center">
                  <Anchor className="h-6 w-6 text-muted-foreground/40 mb-1" />
                  <span className="text-xs font-medium text-muted-foreground">Sin embarques en esta etapa</span>
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5">Se actualiza con el tracking internacional</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
