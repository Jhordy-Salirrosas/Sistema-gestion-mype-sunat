import { Badge } from '@/components/ui';
import type { ReconcileScenario } from '../types/sire.types';
import { scenarioPresentation } from '../lib/sireScenarios';

export const MatchStatusBadge = ({ status }: { status: ReconcileScenario }) => {
  const presentation = scenarioPresentation[status];
  return (
    <Badge variant="outline" className={presentation.className}>
      {presentation.label}
    </Badge>
  );
};
