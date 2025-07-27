'use client';

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintButton() {
  const handlePrint = () => {
    const printContents = document.querySelector('.print-area')?.innerHTML;

    if (printContents) {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Invoice</title>');
        // 可加上樣式（inline 或載入樣式連結）
        printWindow.document.write(`
            <style>
              body {
                font-family: sans-serif;
                padding: 20px;
              }
              .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .justify-end { justify-content: flex-end; }
              .grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 2rem;
              }
              .text-right {
                text-align: right;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              h1, h2, h3, p {
                margin: 0;
                padding: 0;
              }
              .rounded-xl { border-radius: 1rem; }
              .p-8 { padding: 2rem; }
              .mb-8 { margin-bottom: 2rem; }
              .mb-4 { margin-bottom: 1rem; }
              .text-xl { font-size: 1.25rem; font-weight: 700; }
              .text-2xl { font-size: 1.5rem; font-weight: 700; }
              .text-3xl { font-size: 1.5rem; font-weight: 700; white-space: nowrap;}
              .text-lg { font-size: 1.125rem; font-weight: 600; }
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .text-gray-500 { color: #6B7280; }
              .text-xs { font-size: 0.75rem; }
              .inline-block { display: inline-block; }
              .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
              .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
              .rounded-md { border-radius: 0.375rem; }
              .space-y-1 > * + * { margin-top: 0.25rem; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 8px; }
            </style>
          `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContents);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  return (
    <Button variant="outline" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-2" />
      Print
    </Button>
  );
}