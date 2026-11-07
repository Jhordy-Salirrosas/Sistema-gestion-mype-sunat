import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type Role } from '../types/auth.types';

interface DemoUser {
  role: Role;
  label: string;
  email: string;
  badgeClass: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    role: 'ADMIN',
    label: 'Admin',
    email: 'admin@mype.pe',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20',
  },
  {
    role: 'CONTADOR',
    label: 'Contador',
    email: 'contador@mype.pe',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
  },
  {
    role: 'OPERADOR_FACTURACION',
    label: 'Facturador',
    email: 'facturador@mype.pe',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20',
  },
  {
    role: 'OPERADOR_ADUANAS',
    label: 'Aduanas',
    email: 'aduanas@mype.pe',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
  },
  {
    role: 'AUDITOR',
    label: 'Auditor',
    email: 'auditor@mype.pe',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 hover:bg-slate-500/20',
  },
];

interface DemoCredentialsBoxProps {
  onSelect: (email: string, password: string) => void;
}

export const DemoCredentialsBox = ({ onSelect }: DemoCredentialsBoxProps) => {
  return (
    <div className="mt-4 p-3.5 rounded-xl border border-dashed bg-muted/40 text-xs space-y-2">
      <div className="flex items-center justify-between text-muted-foreground font-medium">
        <span className="flex items-center gap-1.5 text-foreground font-semibold">
          <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          Acceso Rápido Demo (1-Clic)
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">Password123!#</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DEMO_USERS.map((user) => (
          <button
            key={user.role}
            type="button"
            onClick={() => onSelect(user.email, 'Password123!#')}
            className="focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-full transition-transform active:scale-95"
            title={`Iniciar como ${user.label} (${user.email})`}
          >
            <Badge
              variant="outline"
              className={`cursor-pointer px-2.5 py-0.5 text-[11px] font-medium border ${user.badgeClass}`}
            >
              {user.label}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
};
