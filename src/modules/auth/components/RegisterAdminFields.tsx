import { type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { type RegisterFormData } from '../validators/authSchema';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { Input, PageField, PageText } from '@/components/ui';
import { Eye, EyeOff, UserCheck } from 'lucide-react';

interface Props {
  register: UseFormRegister<RegisterFormData>;
  errors: FieldErrors<RegisterFormData>;
  showPassword: boolean;
  setShowPassword: (show: boolean | ((prev: boolean) => boolean)) => void;
  passwordValue: string;
}

export const RegisterAdminFields = ({
  register,
  errors,
  showPassword,
  setShowPassword,
  passwordValue,
}: Props) => {
  return (
    <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
      <div className="flex items-center gap-2 pb-1 border-b text-xs font-bold text-foreground">
        <UserCheck className="h-4 w-4 text-primary" />
        <span>2. Administrador Principal</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PageField label="Nombre Completo" htmlFor="reg-fullName">
          <Input id="reg-fullName" placeholder="Juan Pérez Mendoza" {...register('fullName')} />
          {errors.fullName && <PageText variant="error">{errors.fullName.message}</PageText>}
        </PageField>

        <PageField label="Correo Corporativo" htmlFor="reg-email">
          <Input id="reg-email" type="email" placeholder="admin@mi-empresa.pe" {...register('email')} />
          {errors.email && <PageText variant="error">{errors.email.message}</PageText>}
        </PageField>
      </div>

      <PageField label="Contraseña Maestra" htmlFor="reg-password">
        <div className="relative">
          <Input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            {...register('password')}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Ocultar Contraseña' : 'Mostrar Contraseña'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrengthMeter password={passwordValue} />
        {errors.password && <PageText variant="error">{errors.password.message}</PageText>}
      </PageField>
    </div>
  );
};
