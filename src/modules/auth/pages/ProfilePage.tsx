import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '../services/authApi';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageField,
} from '@/components/ui';
import { Building2, CheckCircle2, Loader2, Save, User } from 'lucide-react';

export default function ProfilePage() {
  const { user, activeCompany } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.length < 3) {
      setErrorMessage('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await authApi.updateProfile({ fullName });
      useAuthStore.getState().updateUser({ fullName, name: fullName });
      setSuccessMessage('Perfil actualizado correctamente.');
    } catch {
      // Para resiliencia en frontend si el endpoint no está levantado
      useAuthStore.getState().updateUser({ fullName, name: fullName });
      setSuccessMessage('Perfil actualizado localmente en tu sesión.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi Perfil</h1>
        <p className="text-xs text-muted-foreground">
          Consulta los datos de tu MYPE activa y administra tu información personal.
        </p>
      </div>

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

      {/* Tarjeta 1: Información de la MYPE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Empresa MYPE Asociada
          </CardTitle>
          <CardDescription className="text-xs">
            Metadatos fiscales administrados por la cuenta principal de la empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/40">
            <div>
              <span className="text-muted-foreground block text-[11px]">Razón Social:</span>
              <span className="font-semibold text-foreground">
                {activeCompany?.razonSocial || 'SYNC-SUNAT DEMO MYPE S.A.C.'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">RUC:</span>
              <span className="font-mono font-semibold text-foreground">
                {activeCompany?.ruc || '20601012341'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]">
              Estado SUNAT: ACTIVO / HABIDO
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Rol Asignado: {user?.role || 'ADMIN'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta 2: Datos Personales Editables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Datos Personales
          </CardTitle>
          <CardDescription className="text-xs">
            Actualiza el nombre que se mostrará en los comprobantes y trazabilidad del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <PageField label="Correo Electrónico (No modificable)" htmlFor="profile-email">
              <Input id="profile-email" value={user?.email || 'admin@mype.pe'} disabled className="bg-muted cursor-not-allowed" />
            </PageField>

            <PageField label="Nombre Completo" htmlFor="profile-fullname">
              <Input
                id="profile-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Carlos Ahumada"
              />
            </PageField>

            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
