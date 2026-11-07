import { useSearchParams, useNavigate } from 'react-router-dom';
import { Page, PageHeader, Button, Alert, AlertTitle, AlertDescription } from '@/components/ui';
import {
  CustomsSubNav,
  DuaWizardStepper,
  DuaStep1Header,
  DuaStep2SeriesTable,
  DuaStep3Valuation,
  DuaStep4Confirmation,
} from '../components';
import { useDuaWizard } from '../hooks/useDuaWizard';
import type { RegisterDuaWizardPayload } from '../types/customsDeclaration.types';
import { ArrowLeft, ArrowRight, RotateCcw, CheckCircle2, CreditCard } from 'lucide-react';

export default function DuaRegistrationWizardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shipmentId = searchParams.get('shipmentId') || 'EXP-2026-00042';
  const orderId = searchParams.get('orderId');

  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    formData,
    updateFormData,
    clearDraft,
    calculatedInsurance,
    submitDuaWizard,
    isSubmitting,
    isSuccess,
    declarationResult,
  } = useDuaWizard(shipmentId, orderId);

  const handleFinalSubmit = async () => {
    try {
      // El borrador está incompleto hasta el paso 4; el backend valida el DTO completo.
      await submitDuaWizard(formData as unknown as RegisterDuaWizardPayload);
    } catch {
      // Manejado por react-query
    }
  };

  if (isSuccess && declarationResult) {
    return (
      <Page>
        <CustomsSubNav />
        <div className="max-w-2xl mx-auto py-8 text-center space-y-4">
          <div className="h-14 w-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2 className="text-xl font-bold">¡Declaración Aduanera (DAM) Numerada con Éxito!</h2>
          <p className="text-xs text-muted-foreground font-mono">
            Número Oficial SUNAT: <span className="font-bold text-primary">{declarationResult.dua_number}</span>
          </p>

          <Alert className="text-left bg-emerald-500/5 border-emerald-500/30 text-xs">
            <AlertTitle className="font-bold text-emerald-700 dark:text-emerald-300">
              Canal de Control Asignado: {declarationResult.channel}
            </AlertTitle>
            <AlertDescription className="text-muted-foreground mt-1">
              Se han generado las órdenes de cobranza SUNAT (Cuota 0010 Derechos DAM y Cuota 0026 Percepción IGV)
              con sus respectivos Códigos de Documento Aduanero (CDA) listos para pago bancario.
            </AlertDescription>
          </Alert>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => navigate('/customs/settlements')}
              className="gap-2 text-xs"
            >
              <CreditCard className="h-4 w-4" />
              Ir a Mesa de Cobranza CDA
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/customs/shipments/${shipmentId}`)}
              className="text-xs"
            >
              Ver Expediente 360°
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <CustomsSubNav />

      <PageHeader
        title="3. Despacho y Declaración Aduanera (DAM / DUA)"
        description="Declaración Aduanera de Mercancías (Formatos A, B y C), series arancelarias y numeración oficial ante SUNAT."
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearDraft}
            className="text-xs gap-1.5 h-8 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar Borrador
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customs/shipments')}
            className="text-xs gap-1.5 h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Salir
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4 max-w-4xl mx-auto">
        <DuaWizardStepper currentStep={currentStep} onStepClick={setCurrentStep} />

        {/* Pasos Reactivos */}
        {currentStep === 1 && (
          <DuaStep1Header data={formData} onChange={updateFormData} />
        )}

        {currentStep === 2 && (
          <DuaStep2SeriesTable
            items={formData.items || []}
            onChangeItems={(items) => {
              const fobTotal = items.reduce((acc, i) => acc + (i.fob_usd || 0), 0);
              updateFormData({ items, fob_total_usd: Number(fobTotal.toFixed(2)) });
            }}
          />
        )}

        {currentStep === 3 && (
          <DuaStep3Valuation
            data={formData}
            onChange={updateFormData}
            calculatedTppsInsurance={calculatedInsurance}
          />
        )}

        {currentStep === 4 && (
          <DuaStep4Confirmation
            data={formData}
            isSubmitting={isSubmitting}
            onConfirm={handleFinalSubmit}
          />
        )}

        {/* Barra de Navegación del Wizard */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={prevStep}
            disabled={currentStep === 1 || isSubmitting}
            className="text-xs gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Paso Anterior
          </Button>

          {currentStep < 4 ? (
            <Button
              size="sm"
              onClick={nextStep}
              className="text-xs gap-1.5"
            >
              Siguiente Paso
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Transmitiendo a SUNAT...' : 'Transmitir y Numerar DAM'}
            </Button>
          )}
        </div>
      </div>
    </Page>
  );
}
