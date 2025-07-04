
'use client';

export async function pdfPageToPng(file: File, pageNum = 1): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('pdfPageToPng must run in the browser');
  }

  // 🟢 Import the top-level module — fewer edge-cases
  // @ts-ignore  pdfjs-dist has no types for the root entry
  const pdfjs: any = await import('pdfjs-dist');

  const { getDocument, GlobalWorkerOptions } = pdfjs;

  // Point the worker to a CDN copy (or your own /public copy if you prefer)
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs';
  }

  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const page = await pdf.getPage(pageNum);

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
