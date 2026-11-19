import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
/** No presupone progreso del servidor; nunca muestra porcentajes inventados. */
export function InvoiceWait({ label, skeleton = false }: {label: string; skeleton?: boolean}) {
 const [largo, setLargo] = useState(0);
 useEffect(() => { const corto=setTimeout(()=>setLargo(1),2000); const largo=setTimeout(()=>setLargo(2),10000); return ()=>{clearTimeout(corto);clearTimeout(largo);}; },[]);
 if (!largo) return null;
 return <div role="status" aria-live="polite" className="space-y-3 p-3"><p className="flex items-center gap-2"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />{label}{largo===2 ? ' La consulta sigue en curso; espere antes de repetir.' : ''}</p>
 {skeleton && <div aria-hidden="true" className="grid animate-pulse gap-3 sm:grid-cols-3">{[0,1,2].map(n=><div key={n} className="h-24 rounded-lg bg-muted" />)}</div>}</div>;
}
