import { RegisterForm } from '../components/RegisterForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  PageCenter,
  PageTitle,
} from '@/components/ui';
import { Building2 } from 'lucide-react';

export default function RegisterPage() {
  return (
    <PageCenter>
      <Card className="w-full max-w-xl my-8 shadow-xl border-muted/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <PageTitle className="text-xl font-bold tracking-tight">Registro de Nueva MYPE</PageTitle>
          <CardDescription className="text-xs">
            Afiliación de empresa cliente y configuración del Administrador en SYNC-SUNAT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </PageCenter>
  );
}
