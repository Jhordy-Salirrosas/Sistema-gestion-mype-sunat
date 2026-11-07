import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

export const PasswordStrengthMeter = ({ password }: PasswordStrengthMeterProps) => {
  const requirements: Requirement[] = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Una letra mayúscula (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Una letra minúscula (a-z)', met: /[a-z]/.test(password) },
    { label: 'Un número (0-9)', met: /[0-9]/.test(password) },
    { label: 'Un carácter especial (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = requirements.filter((req) => req.met).length;

  const getStrengthMeta = () => {
    if (password.length === 0) return { label: 'Sin ingresar', width: 'w-0', color: 'bg-muted' };
    if (score <= 2) return { label: 'Débil', width: 'w-1/3', color: 'bg-destructive' };
    if (score <= 4) return { label: 'Media', width: 'w-2/3', color: 'bg-amber-500' };
    return { label: 'Segura', width: 'w-full', color: 'bg-emerald-500' };
  };

  const meta = getStrengthMeta();

  return (
    <div className="space-y-2.5 pt-1 text-xs" aria-live="polite">
      {/* Barra de progreso visual */}
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Fortaleza:</span>
        <span className={cn('font-semibold', meta.color.replace('bg-', 'text-'))}>
          {meta.label}
        </span>
      </div>

      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300 rounded-full', meta.width, meta.color)}
        />
      </div>

      {/* Lista interactiva de requisitos */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-muted-foreground">
        {requirements.map((req) => (
          <li
            key={req.label}
            className={cn(
              'flex items-center gap-1.5 transition-colors',
              req.met ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'
            )}
          >
            {req.met ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
