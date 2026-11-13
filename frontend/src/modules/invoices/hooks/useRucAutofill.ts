import { useEffect, useRef, useState } from 'react';
import { rucValido } from '../lib/invoiceEmitValidation';
import { consultarRuc, type DatosRuc } from '../services/rucApi';

/** Consulta solo tras editar el documento; una edición manual invalida respuestas pendientes. */
export function useRucAutofill(onDatos: (datos: DatosRuc) => void) {
  const [aviso, setAviso] = useState('');
  const secuencia = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => { secuencia.current++; window.clearTimeout(timer.current); }, []);

  const cancelar = () => {
    secuencia.current++;
    window.clearTimeout(timer.current);
    setAviso('');
  };
  const consultar = (ruc: string) => {
    cancelar();
    if (!rucValido(ruc)) return;
    const solicitud = secuencia.current;
    timer.current = window.setTimeout(() => {
      setAviso('Consultando RUC… Puede continuar completando los datos.');
      void consultarRuc(ruc).then((datos) => {
        if (solicitud !== secuencia.current) return;
        onDatos(datos);
        setAviso(datos.direccionFiscal
          ? 'Datos del RUC completados. Puede editar la razón social y la dirección.'
          : 'Razón social completada. El proveedor no informó dirección; complétela manualmente.');
      }).catch(() => {
        if (solicitud === secuencia.current) setAviso('No se pudo consultar el RUC. Puede completar la razón social y la dirección manualmente.');
      });
    }, 300);
  };
  return { consultar, cancelar, aviso };
}
