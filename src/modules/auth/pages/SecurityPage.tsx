import { useState } from 'react';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Alert, AlertDescription } from '@/components/ui';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function SecurityPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
  };

  const handleError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Seguridad y Acceso</h1>
        <p className="text-xs text-muted-foreground">
          Actualiza tus credenciales de acceso y protege la cuenta de tu empresa.
        </p>
      </div>

      {/* Alerta informativa en ámbar sobre revocación de sesiones */}
      <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-xs">
          <strong>Aviso de Seguridad:</strong> Al actualizar tu contraseña, se cerrarán automáticamente
          todas las demás sesiones activas en otros navegadores o dispositivos.
        </AlertDescription>
      </Alert>

      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <ChangePasswordForm onSuccess={handleSuccess} onError={handleError} />
    </div>
  );
}
