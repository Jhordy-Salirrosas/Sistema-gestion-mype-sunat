import React from 'react';
import { type UseFormRegister } from 'react-hook-form';
import { type GoodsReceiptFormData } from '../validators/goodsReceiptSchema';
import { Input } from '@/components/ui/input';

interface GoodsReceiptItemsTableProps {
  fields: Array<{ id: string; productCode: string; commercialDescription: string; destinationType: string }>;
  watchedItems: GoodsReceiptFormData['items'];
  register: UseFormRegister<GoodsReceiptFormData>;
}

export const GoodsReceiptItemsTable: React.FC<GoodsReceiptItemsTableProps> = ({
  fields,
  watchedItems,
  register,
}) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-800/80 uppercase text-slate-400">
          <tr>
            <th className="p-3">Producto / Serie</th>
            <th className="p-3">Destino</th>
            <th className="p-3">Declarado</th>
            <th className="p-3">Recibido Conforme</th>
            <th className="p-3">Averiado / Roto</th>
            <th className="p-3">Diferencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {fields.map((field, idx) => {
            const declared = watchedItems[idx]?.declaredQuantity || 0;
            const received = watchedItems[idx]?.receivedQuantity || 0;
            const damaged = watchedItems[idx]?.damagedQuantity || 0;
            const diff = received - declared;

            return (
              <tr key={field.id} className="hover:bg-slate-800/30">
                <td className="p-3">
                  <div className="font-semibold">{field.productCode}</div>
                  <div className="text-slate-400">{field.commercialDescription}</div>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      field.destinationType === 'ACTIVO_FIJO'
                        ? 'bg-purple-900/60 text-purple-300'
                        : 'bg-blue-900/60 text-blue-300'
                    }`}
                  >
                    {field.destinationType}
                  </span>
                </td>
                <td className="p-3 font-semibold">{declared}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    step="any"
                    {...register(`items.${idx}.receivedQuantity`, { valueAsNumber: true })}
                    className="h-8 w-24 bg-slate-800 text-slate-100"
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    step="any"
                    {...register(`items.${idx}.damagedQuantity`, { valueAsNumber: true })}
                    className="h-8 w-24 bg-slate-800 text-slate-100"
                  />
                </td>
                <td className="p-3 font-bold">
                  <span
                    className={
                      diff === 0 && damaged === 0 ? 'text-emerald-400' : 'text-amber-400'
                    }
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

