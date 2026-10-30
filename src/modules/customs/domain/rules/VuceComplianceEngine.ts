/**
 * Motor de Cumplimiento Normativo VUCE (Ventanilla Única de Comercio Exterior).
 * Valida si una Subpartida Nacional (SPN) corresponde a mercancías restringidas
 * sujetas a autorización previa, registro sanitario o permiso de internamiento.
 */

export interface VuceRestrictionCheck {
  hsCode: string;
  isRestricted: boolean;
  controllingEntity?: 'MTC' | 'DIGESA' | 'DIGEMID' | 'SUCAMEC' | 'SENASA' | 'PRODUCE';
  permitName?: string;
  isResolutionRequired: boolean;
  warningMessage?: string;
}

export class VuceComplianceEngine {
  /**
   * Catálogo de prefijos de subpartidas arancelarias sujetas a control regulatorio sectorial en el Perú
   */
  private static readonly RESTRICTED_CATALOG: Array<{
    prefix: string;
    entity: 'MTC' | 'DIGESA' | 'DIGEMID' | 'SUCAMEC' | 'SENASA' | 'PRODUCE';
    permitName: string;
    description: string;
  }> = [
    {
      prefix: '8517',
      entity: 'MTC',
      permitName: 'Certificado de Homologación e Internamiento MTC',
      description: 'Equipos de telecomunicaciones, celulares, routers y transmisores de radiofrecuencia',
    },
    {
      prefix: '8525',
      entity: 'MTC',
      permitName: 'Permiso de Internamiento de Equipos Transmisores',
      description: 'Cámaras de televisión, aparatos de radiodifusión y drones con enlace RF',
    },
    {
      prefix: '3004',
      entity: 'DIGEMID',
      permitName: 'Registro Sanitario de Medicamentos y Fármacos',
      description: 'Medicamentos constituidos por productos mezclados o sin mezclar para uso terapéutico',
    },
    {
      prefix: '3304',
      entity: 'DIGEMID',
      permitName: 'Notificación Sanitaria Obligatoria (NSO) Cosméticos',
      description: 'Preparaciones de belleza, maquillaje y cuidado de la piel',
    },
    {
      prefix: '9503',
      entity: 'DIGESA',
      permitName: 'Autorización Sanitaria e Importación de Juguetes',
      description: 'Triciclos, patinetas, autos de pedales y juguetes similares con sustancias no tóxicas',
    },
    {
      prefix: '2106',
      entity: 'DIGESA',
      permitName: 'Registro Sanitario de Alimentos y Bebidas Industrializadas',
      description: 'Preparaciones alimenticias y suplementos dietéticos no expresados en otra parte',
    },
    {
      prefix: '9301',
      entity: 'SUCAMEC',
      permitName: 'Autorización Previa de Importación de Armas y Artículos Conexos',
      description: 'Armas de guerra, revólveres, pistolas y municiones para defensa personal',
    },
    {
      prefix: '0701',
      entity: 'SENASA',
      permitName: 'Permiso Fitosanitario de Importación (PFI)',
      description: 'Papas frescas, semillas y tubérculos sujetos a inspección cuarentenaria',
    },
    {
      prefix: '2903',
      entity: 'PRODUCE',
      permitName: 'Autorización de Importación de Sustancias Agotadoras de Ozono (SAO)',
      description: 'Derivados halogenados de los hidrocarburos regulados por el Protocolo de Montreal',
    },
  ];

  /**
   * Evalúa si una subpartida nacional de 10 dígitos o 4 dígitos de partida requiere trámite VUCE
   */
  public static verifyRestriction(rawHsCode: string): VuceRestrictionCheck {
    if (!rawHsCode) {
      return {
        hsCode: '',
        isRestricted: false,
        isResolutionRequired: false,
      };
    }

    const cleanCode = rawHsCode.replace(/[.\-\s]/g, '');

    for (const rule of this.RESTRICTED_CATALOG) {
      if (cleanCode.startsWith(rule.prefix)) {
        return {
          hsCode: cleanCode,
          isRestricted: true,
          controllingEntity: rule.entity,
          permitName: rule.permitName,
          isResolutionRequired: true,
          warningMessage: `Mercancía RESTRINGIDA controlada por ${rule.entity}: Requiere ${rule.permitName} (${rule.description}).`,
        };
      }
    }

    return {
      hsCode: cleanCode,
      isRestricted: false,
      isResolutionRequired: false,
    };
  }

  /**
   * Valida una lista de ítems de DAM devolviendo todas las restricciones detectadas
   */
  public static verifyBatch(items: Array<{ hsCode: string; commercialDescription?: string }>): VuceRestrictionCheck[] {
    return items
      .map((it) => this.verifyRestriction(it.hsCode))
      .filter((res) => res.isRestricted);
  }
}

