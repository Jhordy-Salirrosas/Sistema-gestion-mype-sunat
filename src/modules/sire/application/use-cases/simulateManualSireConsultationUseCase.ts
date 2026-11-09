import { Injectable } from '@nestjs/common';

interface ManualSireConsultationInput {
  ruc: string;
  period: string;
}

function simulatedDate(period: string, day: string): string {
  return `${period.slice(0, 4)}-${period.slice(4)}-${day}`;
}

@Injectable()
export class SimulateManualSireConsultationUseCase {
  execute({ ruc, period }: ManualSireConsultationInput) {
    const rvieRecords = [
      {
        relatedRuc: ruc,
        documentType: '01',
        series: 'FDEM',
        correlative: '1',
        issueDate: simulatedDate(period, '05'),
        taxableBase: 100,
        igvAmount: 18,
        totalAmount: 118,
        car: `DEMO-RVIE-${period}-001`,
      },
    ];
    const rceRecords = [
      {
        relatedRuc: ruc,
        documentType: '01',
        series: 'FDEM',
        correlative: '1',
        issueDate: simulatedDate(period, '10'),
        taxableBase: 250,
        igvAmount: 45,
        totalAmount: 295,
        car: `DEMO-RCE-${period}-001`,
      },
    ];

    return {
      mode: 'SIMULATED' as const,
      sunatContacted: false,
      solCredentialStored: false,
      ruc,
      period,
      message:
        'Resultado simulado. No se consultó SUNAT y la clave SOL no fue validada, almacenada ni transmitida.',
      modules: [
        {
          code: 'RVIE' as const,
          name: 'Registro de Ventas e Ingresos Electrónico',
          bookType: 'RVIE_VENTAS' as const,
          relatedRuc: ruc,
          state: 'SIMULATED' as const,
          count: rvieRecords.length,
          records: rvieRecords,
        },
        {
          code: 'RCE' as const,
          name: 'Registro de Compras Electrónico',
          bookType: 'RCE_COMPRAS' as const,
          relatedRuc: ruc,
          state: 'SIMULATED' as const,
          count: rceRecords.length,
          records: rceRecords,
        },
      ],
    };
  }
}
