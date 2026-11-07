import { LoginForm } from '../components/LoginForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  PageCenter,
  PageTitle,
} from '@/components/ui';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <PageCenter>
      <Card className="w-full max-w-md shadow-lg border-muted/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <PageTitle className="text-xl font-bold tracking-tight">SYNC-SUNAT</PageTitle>
          <CardDescription className="text-xs">
            Sistema de Gestión Tributaria y Financiera para MYPES
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </PageCenter>
  );
}
