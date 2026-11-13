import { useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoiceBatchRetryApi, type ReintentoMasivo } from '../services/invoiceBatchRetryApi';

function Resumen({ datos }: {datos:ReintentoMasivo}) {
  return <div className="space-y-1">
    <p>Elegibles para intentar: {datos.elegibles}</p><p>Encolados: {datos.encolados}</p>
    <p>Omitidos por incertidumbre: {datos.omitidos_incertidumbre}</p>
    <p>Omitidos por rechazo definitivo de SUNAT: {datos.omitidos_rechazo_definitivo}</p>
    <p>Omitidos por bloqueo local: {datos.omitidos_bloqueo_local}</p>
    <p>En curso en otro lote: {datos.en_curso}</p><p>Ya en cola: {datos.ya_en_cola}</p><p>Omitidos por estado: {datos.omitidos_estado}</p>
    <p>No confirmados: {datos.no_confirmados}</p>
    <details><summary>Detalle por comprobante</summary><ul className="max-h-64 overflow-auto">
      {datos.documentos.map(d=><li key={d.id}><strong>{d.numero}</strong>: {d.motivo}</li>)}
    </ul></details>
  </div>;
}

export function InvoiceBatchRetry({ onComplete }: {onComplete:()=>void}) {
  const { isAdmin }=useRolePermissions();
  const [abierto,setAbierto]=useState(false),[ocupado,setOcupado]=useState(false);
  const [previa,setPrevia]=useState<ReintentoMasivo|null>(null);
  const [resultado,setResultado]=useState<ReintentoMasivo|null>(null);
  const [error,setError]=useState<string|null>(null);
  const enCurso=useRef(false);
  const abrir=async()=>{
    if(enCurso.current)return;
    enCurso.current=true;setOcupado(true);setAbierto(true);setPrevia(null);setError(null);
    try{setPrevia(await invoiceBatchRetryApi.previa());}
    catch(e){setError(extractApiErrorMessage(e,'No se pudo obtener la vista previa.'));}
    finally{enCurso.current=false;setOcupado(false);}
  };
  const ejecutar=async()=>{
    if(enCurso.current)return;
    enCurso.current=true;setOcupado(true);setError(null);
    try{
      setResultado(await invoiceBatchRetryApi.ejecutar());setAbierto(false);onComplete();
    }catch(e){setError(extractApiErrorMessage(e,'No se pudo confirmar el reenvío. Actualice el Monitor antes de repetir.'));}
    finally{enCurso.current=false;setOcupado(false);}
  };
  if(!isAdmin)return null;
  return <section aria-label="Reenvío masivo del Monitor" className="space-y-3">
    <Button type="button" variant="outline" disabled={ocupado} onClick={()=>void abrir()}>Reenviar encolados</Button>
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmar reenvío masivo</DialogTitle>
          <DialogDescription>La API reevaluará todos los comprobantes elegibles de la empresa. La incertidumbre se consulta; los rechazos definitivos y bloqueos que requieren corregir datos se omiten.</DialogDescription>
        </DialogHeader>
        {ocupado && <p role="status">Consultando o registrando reintentos…</p>}
        {previa && <Resumen datos={previa} />}
        {error && <p role="alert">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={ocupado} onClick={()=>setAbierto(false)}>Cancelar</Button>
          <Button type="button" disabled={ocupado || !previa || previa.elegibles===0} onClick={()=>void ejecutar()}>Confirmar reenvío</Button></div>
      </DialogContent>
    </Dialog>
    {resultado && <Alert><AlertTitle>Resultado del reenvío masivo</AlertTitle><AlertDescription>
      <Resumen datos={resultado} />
      <p>Los conteos corresponden a la ejecución reevaluada por la API. Actualizar el Monitor conserva este resultado.</p>
    </AlertDescription></Alert>}
  </section>;
}
