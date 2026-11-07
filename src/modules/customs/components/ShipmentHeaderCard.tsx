import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ship, Calendar, MapPin, Building2, UserCheck } from 'lucide-react';
import { type CustomsShipmentDetail } from '../types';

interface ShipmentHeaderCardProps {
  shipment: CustomsShipmentDetail;
}

export const ShipmentHeaderCard: React.FC<ShipmentHeaderCardProps> = ({ shipment }) => {
  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{shipment.shipment_number}</h3>
              <p className="text-xs text-muted-foreground">Expediente Digital de Comercio Exterior</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {shipment.incoterm}
            </Badge>
            <Badge variant="default" className="text-xs font-semibold uppercase">
              {shipment.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Proveedor</p>
              <p className="font-medium text-foreground truncate max-w-[140px]">
                {shipment.supplier?.business_name || shipment.supplier_name || 'Shenzhen Tech Ltd.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Agente Aduanal</p>
              <p className="font-medium text-foreground truncate max-w-[140px]">
                {shipment.customs_broker?.business_name || 'Agencia Callao S.A.C.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Destino Aduana</p>
              <p className="font-medium text-foreground">
                {shipment.destination_customs} - {shipment.transport_mode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Fecha Estimada (ETA)</p>
              <p className="font-medium text-foreground">
                {shipment.eta_date ? new Date(shipment.eta_date).toLocaleDateString('es-PE') : 'No definida'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Orden de Origen</p>
              <p className="font-semibold text-primary truncate max-w-[150px]">
                {shipment.order_reference || 'ORD-2026-00042 (100 Laptops)'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
