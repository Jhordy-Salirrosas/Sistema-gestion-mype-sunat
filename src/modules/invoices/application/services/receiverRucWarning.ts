import { RucConsultaService } from '../../../sunat/rucConsultaService';
import { esRucValido } from '../../domain/rules/taxpayerIdValidator';
import type { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';

/** Solo avisos informativos del receptor; cualquier fallo conserva la emisión. */
export async function avisosPadronReceptor(dto: EmitirComprobanteDto, consulta?: Pick<RucConsultaService, 'consultar'>, timeoutMs = 2000): Promise<string[]> {
  const ruc = dto.customer_identity_number ?? '';
  if (!consulta || !esRucValido(ruc) || (dto.customer_identity_type && dto.customer_identity_type !== '6')) return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const datos = await Promise.race([
      consulta.consultar(ruc),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (!datos || datos.ruc !== ruc || !datos.razonSocial?.trim() || !datos.estadoContribuyente?.trim() || !datos.condicionDomicilio?.trim()) return [];
    const estado = datos.estadoContribuyente.trim().toUpperCase();
    const condicion = datos.condicionDomicilio.trim().toUpperCase().replace(/[_\s]+/g, ' ');
    return [
      ...(estado !== 'ACTIVO' ? [`Receptor ${ruc}: estado del contribuyente ${estado}.`] : []),
      ...(condicion === 'NO HABIDO' ? [`Receptor ${ruc}: condición de domicilio NO HABIDO.`] : []),
    ];
  } catch { return []; }
  finally { clearTimeout(timer); }
}
