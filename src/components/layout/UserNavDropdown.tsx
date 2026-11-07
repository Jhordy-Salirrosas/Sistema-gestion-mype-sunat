import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { type Role } from '@/modules/auth/types/auth.types';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const UserNavDropdown = () => {
  const { user, activeCompany, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const role = user?.role;
  const fullName = user?.fullName || user?.name || 'Usuario';

  // Obtener iniciales para el avatar
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const getRoleStyle = (r?: Role) => {
    switch (r) {
      case 'ADMIN':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'CONTADOR':
      case 'ACCOUNTANT':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'OPERADOR_FACTURACION':
        return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
      case 'OPERADOR_ADUANAS':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'AUDITOR':
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-muted/60 transition-colors focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/20">
          {initials}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold leading-tight text-foreground truncate max-w-[130px]">
            {fullName}
          </span>
          <div className="pt-0.5">
            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 uppercase border', getRoleStyle(role))}>
              {role || 'OPERADOR'}
            </Badge>
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-card p-2 text-card-foreground shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
          {/* Cabecera con datos de la MYPE */}
          <div className="px-3 py-2 border-b mb-1">
            <p className="text-[11px] font-medium text-muted-foreground">Empresa Conectada</p>
            <p className="text-xs font-bold text-foreground truncate">
              {activeCompany?.razonSocial || 'SYNC-SUNAT DEMO MYPE S.A.C.'}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
              <Building2 className="h-3 w-3" />
              RUC: {activeCompany?.ruc || '20601012341'}
            </p>
          </div>

          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Mi Perfil</span>
          </Link>

          <Link
            to="/settings/security"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span>Seguridad y Contraseña</span>
          </Link>

          <div className="border-t my-1" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg text-destructive hover:bg-destructive/10 transition-colors font-medium text-left"
          >
            <LogOut className="h-4 w-4 text-destructive" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </div>
  );
};
