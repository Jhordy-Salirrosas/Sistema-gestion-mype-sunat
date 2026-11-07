import React from 'react';
import { Card, Button, Badge } from '@/components/ui';
import {
  CheckCircle2,
  Clock,
  FileText,
  FileUp,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  Hash,
} from 'lucide-react';
import type { ImportOrderRecord, StageChecklistItem } from '../services/importOrdersApi';

interface OrderChecklistTabProps {
  order: ImportOrderRecord;
  checklist: StageChecklistItem[];
  isLoading: boolean;
  onOpenAddDocModal: (stageIndex?: number) => void;
}

export const OrderChecklistTab: React.FC<OrderChecklistTabProps> = ({
  order,
  checklist,
  isLoading,
  onOpenAddDocModal,
}) => {
  const completedCount = checklist.filter((c) => c.isCompleted).length;
  const progressPct = Math.round((completedCount / (checklist.length || 14)) * 100);

  return (
    <div className="space-y-4">
      {/* Barra de progreso global del checklist */}
      <Card className="p-4 bg-muted/20 border-dashed">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Checklist Documentario del Flujo Aduanero (14 Etapas)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Documentos obligatorios para la trazabilidad y fiscalización aduanera SUNAT.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-bold">{completedCount} de 14</span>
              <span className="text-xs text-muted-foreground ml-1">completados ({progressPct}%)</span>
            </div>
            <Button
              size="sm"
              onClick={() => onOpenAddDocModal(order.currentStageIndex)}
              className="text-xs gap-1.5 h-8"
            >
              <FileUp className="h-3.5 w-3.5" />
              Adjuntar Documento
            </Button>
          </div>
        </div>

        {/* Progress bar visual */}
        <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </Card>

      {/* Lista de etapas y requerimientos */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Cargando checklist documentario...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {checklist.map((item) => {
            const isStagePassed = order.currentStageIndex > item.stageIndex;
            const isStageCurrent = order.currentStageIndex === item.stageIndex;

            return (
              <Card
                key={item.stageIndex}
                className={`p-3 transition-colors ${
                  isStageCurrent
                    ? 'border-primary/50 bg-primary/5'
                    : item.isCompleted
                    ? 'border-emerald-500/20 bg-card'
                    : 'bg-card'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Status icon */}
                    <div className="mt-0.5 sm:mt-0">
                      {item.isCompleted ? (
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : isStageCurrent ? (
                        <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center animate-pulse">
                          <Clock className="h-4 w-4" />
                        </div>
                      ) : isStagePassed ? (
                        <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">
                          {item.stageIndex}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">
                          Etapa {item.stageIndex}: {item.stageName}
                        </span>
                        {isStageCurrent && (
                          <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">
                            Etapa Actual
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 bg-muted text-muted-foreground font-mono"
                        >
                          {item.mandatoryDocLabel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenAddDocModal(item.stageIndex)}
                      className="text-[11px] h-7 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <FileUp className="h-3 w-3" />
                      Adjuntar
                    </Button>
                  </div>
                </div>

                {/* Documentos adjuntos a esta etapa */}
                {item.documents && item.documents.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-border/50 pl-9 space-y-1.5">
                    {item.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-md bg-muted/40 text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">{doc.fileName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({doc.documentNumber})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {doc.fileHash && (
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border flex items-center gap-1 text-muted-foreground"
                              title={`SHA-256: ${doc.fileHash}`}
                            >
                              <Hash className="h-2.5 w-2.5 text-emerald-600" />
                              {doc.fileHash.slice(0, 8)}...{doc.fileHash.slice(-4)}
                            </span>
                          )}

                          <a
                            href={doc.storageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <span>Ver</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
