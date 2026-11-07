import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customsDeclarationsApi } from '../services/customsDeclarationsApi';
import { customsShipmentsApi } from '../services/customsShipmentsApi';
import { importOrdersApi } from '../services/importOrdersApi';
import { catalogsApi } from '../services/catalogsApi';
import {
  type CustomsDeclarationRecord,
  type RegisterDuaWizardPayload,
  type RegisterDuaWizardItemPayload,
} from '../types';

const DRAFT_PREFIX = 'customs_dua_wizard_draft_';

export const useDuaWizard = (shipmentId: string, orderId?: string | null) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const draftKey = `${DRAFT_PREFIX}${shipmentId || orderId || 'default'}`;

  // Carga del borrador persistido en LocalStorage (ISO 9241-110 Tolerancia a fallos)
  const [formData, setFormData] = useState<Partial<RegisterDuaWizardPayload>>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorar error de JSON parse
    }
    return {
      shipment_id: shipmentId || 'EXP-2026-00042',
      customs_code: '118',
      declaration_year: new Date().getFullYear(),
      dispatch_mode: '10',
      channel: 'VERDE',
      fob_total_usd: 0,
      freight_total_usd: 0,
      insurance_total_usd: 0,
      exchange_rate: 3.82,
      has_article_160_guarantee: false,
      items: [],
    };
  });

  // Auto-poblar desde la Orden o Expediente real si no hay ítems en el borrador
  useEffect(() => {
    let isMounted = true;

    const populateFromRealSource = async () => {
      try {
        // 1. Si viene orderId, cargar directamente de la orden del Paso 1
        if (orderId) {
          const order = await importOrdersApi.getOrderById(orderId);
          if (isMounted && order && order.items && order.items.length > 0) {
            const mappedItems: RegisterDuaWizardItemPayload[] = order.items.map((it, idx) => {
              const qty = Number(it.quantity) || 1;
              const unitPrice = Number(it.unitPriceFob) || 0;
              const totalFob = Number(it.totalFob) || qty * unitPrice;
              return {
                series_order: idx + 1,
                product_code: it.productCode || `PROD-${idx + 1}`,
                hs_code: it.hsCode ? it.hsCode.replace(/\D/g, '') : '8471300000',
                commercial_description: it.description,
                goods_state: 'NUEVO' as const,
                tpi_code: '800',
                physical_quantity: qty,
                physical_unit: it.unitCode || 'NIU',
                net_weight_kg: Number((qty * 2.5).toFixed(2)) || 10,
                gross_weight_kg: Number((qty * 2.8).toFixed(2)) || 12,
                fob_usd: totalFob,
                ad_valorem_rate: 0,
              };
            });

            setFormData((prev) => {
              if (prev.items && prev.items.length > 0) return prev; // respetar si el usuario ya ingresó datos
              return {
                ...prev,
                shipment_id: order.shipment?.shipment_number || prev.shipment_id || `EXP-${order.orderNumber}`,
                fob_total_usd: Number(order.totalFob) || mappedItems.reduce((acc, i) => acc + i.fob_usd, 0),
                freight_total_usd: Number(order.estimatedFreight) || prev.freight_total_usd || 1200,
                insurance_total_usd: Number(order.estimatedInsurance) || prev.insurance_total_usd || 375,
                transport_doc_number: order.proformaNumber || prev.transport_doc_number || `BL-${order.orderNumber}`,
                items: mappedItems,
              };
            });
            return;
          }
        }

        // 2. Si viene shipmentId, consultar el expediente del Paso 2
        if (shipmentId && shipmentId !== 'demo-shipment-001') {
          const shipment = await customsShipmentsApi.getShipmentById(shipmentId);
          if (isMounted && shipment) {
            setFormData((prev) => ({
              ...prev,
              shipment_id: shipment.shipment_number || shipmentId,
              customs_code: shipment.destination_customs?.slice(0, 3) || prev.customs_code || '118',
              transport_doc_number: prev.transport_doc_number || `BL-${shipment.shipment_number || shipmentId}`,
            }));
          }
        }
      } catch {
        // Si no responde la API, mantener los valores en borrador
      }
    };

    if (!formData.items || formData.items.length === 0) {
      populateFromRealSource();
    }

    return () => {
      isMounted = false;
    };
  }, [orderId, shipmentId, formData.items]);

  // Guardado reactivo de borrador
  useEffect(() => {
    if (shipmentId || orderId) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(formData));
      } catch {
        // Cuota excedida de LocalStorage
      }
    }
  }, [formData, draftKey, shipmentId, orderId]);

  const updateFormData = useCallback((partial: Partial<RegisterDuaWizardPayload>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
    setFormData({
      shipment_id: shipmentId || 'EXP-2026-00042',
      customs_code: '118',
      declaration_year: new Date().getFullYear(),
      dispatch_mode: '10',
      channel: 'VERDE',
      fob_total_usd: 0,
      freight_total_usd: 0,
      insurance_total_usd: 0,
      exchange_rate: 3.82,
      has_article_160_guarantee: false,
      items: [],
    });
  }, [draftKey, shipmentId]);

  // Cálculo rápido de seguro supletorio TPPS si el seguro declarado es 0
  const computeCalculatedInsurance = useCallback(() => {
    if ((formData.insurance_total_usd ?? 0) > 0) {
      return formData.insurance_total_usd ?? 0;
    }
    const items = formData.items ?? [];
    if (items.length === 0) return 0;

    let computed = 0;
    for (const item of items) {
      const tppsRate = catalogsApi.getTppsRate(item.hs_code || '84');
      computed += item.fob_usd * (tppsRate / 100);
    }
    return Number(computed.toFixed(2));
  }, [formData.insurance_total_usd, formData.items]);

  const registerDuaMutation = useMutation<
    CustomsDeclarationRecord,
    Error,
    RegisterDuaWizardPayload
  >({
    mutationFn: customsDeclarationsApi.registerDuaWizard,
    onSuccess: () => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ['customs-shipment', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['customs-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['customs-settlements'] });
    },
  });

  return {
    currentStep,
    setCurrentStep,
    nextStep: () => setCurrentStep((prev) => Math.min(prev + 1, 4)),
    prevStep: () => setCurrentStep((prev) => Math.max(prev - 1, 1)),
    formData,
    updateFormData,
    clearDraft,
    calculatedInsurance: computeCalculatedInsurance(),
    submitDuaWizard: registerDuaMutation.mutateAsync,
    isSubmitting: registerDuaMutation.isPending,
    isSuccess: registerDuaMutation.isSuccess,
    declarationResult: registerDuaMutation.data,
  };
};
