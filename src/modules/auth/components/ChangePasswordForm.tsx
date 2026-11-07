import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordFormData } from '../validators/authSchema';
import { authApi } from '../services/authApi';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageField,
  PageText,
} from '@/components/ui';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ChangePasswordForm = ({ onSuccess, onError }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watch('newPassword') || '';

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsSubmitting(true);
    try {
      await authApi.changePassword(data);
      onSuccess('Tu contraseña ha sido actualizada con éxito.');
      reset();
    } catch (err) {
      onError(extractApiErrorMessage(err, 'No se pudo actualizar la contraseña. Verifica tu clave actual.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Cambio de Contraseña
        </CardTitle>
        <CardDescription className="text-xs">
          Ingresa tu contraseña actual y define una nueva con alta complejidad criptográfica.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <PageField label="Contraseña Actual" htmlFor="current-pass">
            <div className="relative">
              <Input
                id="current-pass"
                type={showCurrent ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showCurrent ? 'Ocultar' : 'Mostrar'}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && <PageText variant="error">{errors.currentPassword.message}</PageText>}
          </PageField>

          <PageField label="Nueva Contraseña" htmlFor="new-pass">
            <div className="relative">
              <Input
                id="new-pass"
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showNew ? 'Ocultar' : 'Mostrar'}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPasswordValue} />
            {errors.newPassword && <PageText variant="error">{errors.newPassword.message}</PageText>}
          </PageField>

          <PageField label="Confirmar Nueva Contraseña" htmlFor="confirm-pass">
            <div className="relative">
              <Input
                id="confirm-pass"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <PageText variant="error">{errors.confirmPassword.message}</PageText>}
          </PageField>

          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Actualizar Contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
