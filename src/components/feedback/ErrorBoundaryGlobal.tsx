import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundaryGlobal: Aísla fallos de renderizado en la interfaz.
 * Evita que un error en una tarjeta o tabla vuelva la pantalla completamente blanca.
 */
export class ErrorBoundaryGlobal extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [ErrorBoundary]: Excepción capturada en componente React:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 border border-destructive/30 rounded-xl bg-destructive/5 text-destructive space-y-4 max-w-lg mx-auto my-6 text-center">
          <div className="flex justify-center">
            <AlertCircle className="h-10 w-10 text-destructive animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-base">
              {this.props.fallbackTitle || 'Ocurrió un error inesperado al renderizar este módulo'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || 'Error desconocido de renderizado.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2 mx-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reintentar sección
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
