import { Input } from '@/components/ui';
import { getPeriodFeedback, getRucFeedback } from '../validators/sireSchema';

interface Props {
  period: string;
  ruc: string;
  disabled: boolean;
  showFeedback: boolean;
  onPeriodChange: (value: string) => void;
  onRucChange: (value: string) => void;
}

export const SirePeriodFilter = ({
  period,
  ruc,
  disabled,
  showFeedback,
  onPeriodChange,
  onRucChange,
}: Props) => {
  const periodFeedback = showFeedback ? getPeriodFeedback(period) : null;
  const rucFeedback = showFeedback ? getRucFeedback(ruc) : null;

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium">
        Período (YYYYMM)
        <Input
          aria-label="Período (YYYYMM)"
          inputMode="numeric"
          maxLength={6}
          placeholder="202610"
          value={period}
          disabled={disabled}
          onChange={(event) => onPeriodChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={!!periodFeedback}
        />
        {periodFeedback && <span className="block text-xs text-amber-700">{periodFeedback}</span>}
      </label>
      <label className="space-y-1.5 text-sm font-medium">
        RUC
        <Input
          aria-label="RUC"
          inputMode="numeric"
          maxLength={11}
          placeholder="20123456789"
          value={ruc}
          disabled={disabled}
          onChange={(event) => onRucChange(event.target.value.replace(/\D/g, '').slice(0, 11))}
          aria-invalid={!!rucFeedback}
        />
        {rucFeedback && <span className="block text-xs text-amber-700">{rucFeedback}</span>}
      </label>
    </div>
  );
};
