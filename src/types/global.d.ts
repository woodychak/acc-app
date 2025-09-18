export {};

declare global {
  interface Window {
    duplicateInvoiceData?: any;
    duplicateQuotationData?: any; // or replace `any` with your actual type
  }
}