import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { registerSchema, type RegisterFormData } from '../validators/authSchema';
import { useRegister } from '../hooks/useRegister';
import { RegisterCompanyFields } from './RegisterCompanyFields';
import { RegisterAdminFields } from './RegisterAdminFields';
import { Alert, AlertDescription, Button, PageForm } from '@/components/ui';
import { Loader2 } from 'lucide-react';
import { extractApiErrorMessage } from '@/lib/apiErrors';

export const RegisterForm = () => {
  const { mutate: registerMype, isPending, error } = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showSolPassword, setShowSolPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      ruc: '',
      legalName: '',
      tradeName: '',
      solUser: '',
      solPassword: '',
      fullName: '',
      email: '',
      password: '',
    },
  });

  const passwordValue = watch('password') || '';

  const onSubmit = (data: RegisterFormData) => {
    registerMype(data);
  };

  return (
    <PageForm onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {extractApiErrorMessage(
              error,
              'No se pudo completar el registro. Verifica los datos ingresados o que el RUC/correo no estén ya registrados.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* BLOQUE 1: Datos de la Empresa (MYPE) */}
      <RegisterCompanyFields
        register={register}
        errors={errors}
        showSolPassword={showSolPassword}
        setShowSolPassword={setShowSolPassword}
      />

      {/* BLOQUE 2: Datos del Administrador */}
      <RegisterAdminFields
        register={register}
        errors={errors}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        passwordValue={passwordValue}
      />

      <Button type="submit" disabled={isPending} className="w-full h-11 text-sm font-semibold shadow-sm">
        {isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Registrando Empresa en SUNAT...
          </span>
        ) : (
          'Crear Cuenta MYPE y Comenzar'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-2">
        ¿Ya tienes una cuenta registrada?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión aquí
        </Link>
      </p>
    </PageForm>
  );
};
