import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

console.log("workerUrl type:", typeof workerUrl, workerUrl);


export async function pdfPageToPng(file: File, pageNum = 1) {
  const buf = await file.arrayBuffer();

  const pdf = await getDocument({ data: buf }).promise;
  const page = await pdf.getPage(pageNum);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D context from canvas.");
  }

  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
      "image/png",
      1,
    ),
  );
}