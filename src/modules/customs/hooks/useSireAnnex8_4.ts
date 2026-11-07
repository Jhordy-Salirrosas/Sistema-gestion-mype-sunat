import { useQuery } from '@tanstack/react-query';
import { kardexApi, getDemoSireAnnex8_4 } from '../services/kardexApi';
import { type SireAnnex8_4Record } from '../types';

export const useSireAnnex8_4 = (period?: string) => {
  const sireQuery = useQuery<SireAnnex8_4Record[]>({
    queryKey: ['customs-sire-annex-8-4', period],
    queryFn: () => kardexApi.getSireAnnex8_4(period),
    initialData: () => getDemoSireAnnex8_4(period),
    staleTime: 1000 * 60 * 5,
  });

  const downloadSireTxt = (ruc: string, year: string, month: string) => {
    const records = sireQuery.data ?? [];
    const fileName = `LE${ruc}${year}${month}00080400001111.txt`;

    const lines = records.map((r) =>
      [
        r.period,
        r.cuo,
        r.correlative_number,
        r.document_issue_date,
        '50', // Tipo Comprobante DAM
        r.customs_code,
        r.numeration_year,
        r.correlative_dua,
        r.taxpayer_id,
        r.supplier_name,
        r.taxable_base_pen.toFixed(2),
        r.igv_ipm_pen.toFixed(2),
        r.perception_pen.toFixed(2),
        r.total_import_cost_pen.toFixed(2),
        '1', // Estado de comprobante
      ].join('|') + '|'
    );

    const content = lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    records: sireQuery.data ?? [],
    isLoading: sireQuery.isLoading,
    isError: sireQuery.isError,
    error: sireQuery.error,
    refetch: sireQuery.refetch,
    downloadSireTxt,
  };
};
