import { useEffect, useRef, useState } from 'react';
export interface LocalDraft<T>{version:1;savedAt:string;data:T}
export function readLocalDraft<T>(key:string|null):LocalDraft<T>|null {
 try {const d=key?JSON.parse(localStorage.getItem(key)??'null'):null;return d?.version===1&&typeof d.savedAt==='string'&&d.data&&typeof d.data==='object'?d:null;}catch{return null;}
}
/** Datos locales por usuario/empresa. No almacena credenciales ni forma parte del payload. */
export function useInvoiceLocalDraft<T>(key:string|null,data:T) {
 const [record,setRecord]=useState(()=>({key,disponible:readLocalDraft<T>(key),savedAt:null as string|null}));
 const dirty=useRef(false),enabled=useRef(true);
 const latest=useRef({key,serializado:JSON.stringify(data)});
 const [revision,setRevision]=useState(0);
 const serializado=JSON.stringify(data);
 useEffect(()=>{
  dirty.current=false;enabled.current=true;
  void Promise.resolve().then(()=>setRecord({key,disponible:readLocalDraft<T>(key),savedAt:null}));
  return()=>{
   if(key&&latest.current.key===key&&dirty.current&&enabled.current)try{localStorage.setItem(key,JSON.stringify({version:1,savedAt:new Date().toISOString(),data:JSON.parse(latest.current.serializado)}));}catch{/* No bloquea navegación. */}
  };
 },[key]);
 useEffect(()=>{latest.current={key,serializado};},[key,serializado]);
 useEffect(()=>{
  if(!key||!dirty.current||!enabled.current)return;
  const timer=setTimeout(()=>{if(!dirty.current||!enabled.current)return;try{const savedAt=new Date().toISOString();localStorage.setItem(key,JSON.stringify({version:1,savedAt,data:JSON.parse(serializado)}));setRecord(r=>({...r,key,savedAt}));}catch{/* No anuncia un guardado inexistente. */}},700);
  return()=>clearTimeout(timer);
 },[key,serializado,revision]);
 const marcar=()=>{enabled.current=true;dirty.current=true;setRevision(n=>n+1);};
 const descartar=()=>{if(key)try{localStorage.removeItem(key);}catch{/* Continúa localmente. */}dirty.current=false;enabled.current=false;setRecord({key,disponible:null,savedAt:null});};
 return {disponible:record.key===key?record.disponible:null,savedAt:record.key===key?record.savedAt:null,marcar,descartar,retomado:()=>{setRecord({key,disponible:null,savedAt:null});marcar();}};
}
