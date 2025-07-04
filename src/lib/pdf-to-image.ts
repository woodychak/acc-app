
// src/lib/pdf-to-image.ts
'use client';

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf";

// Set up worker for pdfjs-dist 5.3.31
if (typeof window !== 'undefined') {
  // Using the exact version for the worker
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs`;
}

export async function pdfPageToPng(file: File, pageNum = 1): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('pdfPageToPng must be run in the browser.');
  }

  const buf = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buf });
  const pdf: PDFDocumentProxy = await loadingTask.promise;
  
  const page: PDFPageProxy = await pdf.getPage(pageNum);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context from canvas.');

  // Render the page
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert to PNG Blob
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas-to-Blob failed'))), 'image/png'),
  );
}

// Additional utility function for getting PDF metadata
/* export async function getPdfMetadata(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
}> {
  if (typeof window === 'undefined') {
    throw new Error('getPdfMetadata must be run in the browser.');
  }

  const buf = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buf });
  const pdf: PDFDocumentProxy = await loadingTask.promise;
  
  const metadata = await pdf.getMetadata();
  
  return {
    numPages: pdf.numPages,
    title: metadata.info?.Title,
    author: metadata.info?.Author,
    subject: metadata.info?.Subject,
    creator: metadata.info?.Creator
  }; 
} */
