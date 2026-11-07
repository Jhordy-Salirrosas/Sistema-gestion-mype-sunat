import { type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { type RegisterFormData } from '../validators/authSchema';
import { Input, PageField, PageText } from '@/components/ui';
import { Building, Eye, EyeOff } from 'lucide-react';

interface Props {
  register: UseFormRegister<RegisterFormData>;
  errors: FieldErrors<RegisterFormData>;
  showSolPassword: boolean;
  setShowSolPassword: (show: boolean | ((prev: boolean) => boolean)) => void;
}

export const RegisterCompanyFields = ({
  register,
  errors,
  showSolPassword,
  setShowSolPassword,
}: Props) => {
  return (
    <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
      <div className="flex items-center gap-2 pb-1 border-b text-xs font-bold text-foreground">
        <Building className="h-4 w-4 text-primary" />
        <span>1. Datos de la MYPE</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PageField label="RUC (11 dígitos)" htmlFor="reg-ruc">
          <Input
            id="reg-ruc"
            placeholder="20601012341"
            maxLength={11}
            {...register('ruc')}
            aria-invalid={!!errors.ruc}
          />
          {errors.ruc && <PageText variant="error">{errors.ruc.message}</PageText>}
        </PageField>

        <PageField label="Razón Social" htmlFor="reg-legalName">
          <Input
            id="reg-legalName"
            placeholder="EMPRESA COMERCIAL S.A.C."
            {...register('legalName')}
            aria-invalid={!!errors.legalName}
          />
          {errors.legalName && <PageText variant="error">{errors.legalName.message}</PageText>}
        </PageField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PageField label="Usuario SOL" htmlFor="reg-solUser">
          <Input id="reg-solUser" placeholder="MODDATOS" {...register('solUser')} />
          {errors.solUser && <PageText variant="error">{errors.solUser.message}</PageText>}
        </PageField>

        <PageField label="Clave SOL" htmlFor="reg-solPassword">
          <div className="relative">
            <Input
              id="reg-solPassword"
              type={showSolPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('solPassword')}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSolPassword((p) => !p)}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label={showSolPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showSolPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.solPassword && <PageText variant="error">{errors.solPassword.message}</PageText>}
        </PageField>
      </div>
    </div>
  );
};
