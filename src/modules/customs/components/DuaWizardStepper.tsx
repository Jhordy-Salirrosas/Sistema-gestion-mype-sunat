import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface DuaWizardStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const STEPS = [
  { step: 1, title: 'Cabecera Aduanera' },
  { step: 2, title: 'Series y Arancel' },
  { step: 3, title: 'Valoración & Tributos' },
  { step: 4, title: 'Confirmación & CDA' },
];

export const DuaWizardStepper: React.FC<DuaWizardStepperProps> = ({
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between">
        {STEPS.map((s, index) => {
          const isCompleted = currentStep > s.step;
          const isCurrent = currentStep === s.step;

          return (
            <React.Fragment key={s.step}>
              <button
                type="button"
                onClick={() => isCompleted && onStepClick?.(s.step)}
                disabled={!isCompleted}
                className={cn(
                  'flex items-center gap-2 text-left group transition-all focus:outline-hidden',
                  isCompleted ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                    isCompleted && 'bg-emerald-600 text-white',
                    isCurrent && 'bg-primary text-primary-foreground shadow-xs',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : s.step}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={cn(
                      'text-xs font-semibold leading-none',
                      isCurrent ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    Paso {s.step}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.title}</p>
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-3 transition-colors',
                    currentStep > s.step ? 'bg-emerald-600' : 'bg-muted'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
