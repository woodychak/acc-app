'use client';

import { useState } from "react";
import { pdfPageToPng } from "@/lib/pdf-to-image";

export default function PdfUploadClient() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const png = await pdfPageToPng(file);
    setPreviewUrl(URL.createObjectURL(png));
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFile} />
      {previewUrl && <img src={previewUrl} alt="Preview" />}
    </div>
  );
}