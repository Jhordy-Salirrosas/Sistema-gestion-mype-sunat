export const INVOICE_QUEUED = 'm1:invoice-queued';
export function notifyInvoiceQueued(id: string) {
  window.dispatchEvent(new CustomEvent(INVOICE_QUEUED, { detail: id }));
}
