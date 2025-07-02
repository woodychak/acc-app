// lib/receipt-ocr.ts
import Tesseract from "tesseract.js";

/* ------------------------------------------------------------------------ */
/* 1. CONSTANTS                                                             */
/* ------------------------------------------------------------------------ */

const RAW_AMOUNT_KEYWORDS = [
  "total",
  "total amount",
  "total(incl vat)",
  "total incl vat",
  "total inc vat",
  "balance due",
  "amount due",
  "grand total",
  "amount payable",
  "total due",
  "invoice total",
  "subtotal",
  "sub total",
  "net amount",
  "final amount",
  "sum",
  "payment due",
  "amount owed",
  "bill total",
  "charge",
  "cost",
  "total cost",
  "amount to pay",
  "pay amount",
  "total payable",
  "invoice amount",
  "bill amount",
  "receipt total",
  "order total",
  "purchase total",
  "sale total",
  "transaction total",
  "payable amount",
  "due amount",
  "outstanding",
  "outstanding amount",
  "balance",
  "final total",
  "gross total",
  "net total",
  "amount charged",
  "total charged",
  "total price",
  "price total",
  "sum total",
  "grand sum",
  // Additional invoice-specific keywords
  "invoice value",
  "total value",
  "amount payable",
  "net payable",
  "gross amount",
  "total inclusive",
  "amount inclusive",
  "total excl tax",
  "total incl tax",
  "amount excl tax",
  "amount incl tax",
  "total ex tax",
  "total inc tax",
  "payable now",
  "pay now",
  "remit",
  "remittance",
  "payment amount",
  "settlement amount",
  "final payment",
  "total payment",
  "****", // leave wildcards last – see note below
];

/**
 * Normalise a term: lower-case & strip all non-alnum chars.
 * “Total(INCL VAT)” → “totalinclvat”
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const AMOUNT_KEYWORDS = RAW_AMOUNT_KEYWORDS.map(norm); // now already normalised

const VENDOR_INDICATORS = [
  "receipt",
  "invoice",
  "store",
  "shop",
  "market",
  "restaurant",
  "cafe",
  "ltd",
  "inc",
  "llc",
  "corp",
  "company",
  "co",
  "group",
  "enterprises",
  "services",
  "retail",
  "pharmacy",
  "gas",
  "station",
];

/* ------------------------------------------------------------------------ */
/* 2. TYPES                                                                 */
/* ------------------------------------------------------------------------ */

interface AmountCandidate {
  amount: number;
  confidence: number;
  keyword: string;
  lineIndex: number;
}

type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
};

/* ------------------------------------------------------------------------ */
/* 3. MAIN OCR ENTRY POINT                                                  */
/* ------------------------------------------------------------------------ */

export async function extractReceiptData(
  file: File,
  selectedArea?: Area,
): Promise<{ amount: string; vendor: string; date: string; category: string }> {
  /* ---------- 0. Handle PDF upfront ---------- */
  let imageFile = file;
  if (file.type === "application/pdf") {
    imageFile = await pdfFirstPageToPNG(file);
  }

  /* ---------- 3.1 Crop if user selected a region ---------- */
  const imageToProcess = selectedArea
    ? await cropImageToSelectedArea(imageFile, selectedArea)
    : imageFile;

  /* ---------- 3.2  OCR ---------- */
  const { data } = await Tesseract.recognize(
    await imageToProcess.arrayBuffer(),
    "eng",
    {
      tessedit_pageseg_mode: (Tesseract as any).PSM.SINGLE_BLOCK,
      tessedit_ocr_engine_mode: (Tesseract as any).OEM.LSTM_ONLY,
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:-/$%()[]{}",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_do_invert: "0",
    },
  );

  const lines = data.text.split(/\n+/).map((l) => l.trim());
  const normLines = lines.map(norm);

  /* ---------- 3.3  AMOUNT DETECTION ---------- */
  const amountCandidates: AmountCandidate[] = [];

  for (let i = 0; i < normLines.length; i++) {
    const line = normLines[i];

    // does this normalised line contain ANY normalised keyword?
    const matchedKeyword = AMOUNT_KEYWORDS.find((kw) => line.includes(kw));
    if (!matchedKeyword) continue;

    // Search current line and next 3 lines for amounts
    const searchLines = [
      normLines[i],
      normLines[i + 1] ?? "",
      normLines[i + 2] ?? "",
      normLines[i + 3] ?? "",
    ];

    for (let j = 0; j < searchLines.length; j++) {
      const srcLine = lines[i + j]; // keep original for regex
      if (!srcLine) continue;

      // Enhanced patterns for better amount detection
      const patterns = [
        // Currency symbols with amounts (improved)
        /\$\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*\$/g,
        /€\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*€/g,
        /£\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*£/g,
        /¥\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*¥/g,
        // Additional currency symbols
        /₹\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*₹/g,
        /₩\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*₩/g,

        // Decimal amounts (improved precision)
        /([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{2})(?![0-9])/g,
        /([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{1})(?![0-9])/g,

        // Whole numbers with commas
        /([0-9]{1,3}(?:,?[0-9]{3})+)(?![0-9])/g,

        // Simple decimal patterns
        /([0-9]+\.[0-9]{2})(?![0-9])/g,
        /([0-9]+\.[0-9]{1})(?![0-9])/g,

        // Amounts with currency codes (expanded)
        /(?:usd|eur|gbp|cad|aud|hkd|sgd|jpy|cny|inr|krw|thb|myr|php|nzd|chf|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|brl|mxn|ars|cop|pen|clp|uyu|bob|pyg|vef|gyd|srd|fkp|shp|gip|jep|imp|ggp|mtl|cyp|sit|skk|eek|lvl|ltl|dem|nlg|ats|bef|esp|fim|frf|iep|itl|luf|pte|grd|trl|yer|omr|qar|aed|bhd|kwd|sar|jod|ils|egp|lbp|syp|iqd|irr|afn|pkr|lkr|npr|btd|mvr|bdt|mmk|lak|khr|vnd|idr|myr|php|twd|hkd|mop|cny|kpw|jpy|krw|mnt|kzt|kgs|uzs|tjk|tmt|azn|gel|amd|byn|mdl|uah|rub|try|bgn|ron|hrk|rsd|mkd|all|bam|eur|chf|gbp|isk|nok|sek|dkk|pln|czk|huf|skk|sit|eek|lvl|ltl)\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/gi,
        /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:usd|eur|gbp|cad|aud|hkd|sgd|jpy|cny|inr|krw|thb|myr|php|nzd|chf|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|brl|mxn|ars|cop|pen|clp|uyu|bob|pyg|vef|gyd|srd|fkp|shp|gip|jep|imp|ggp|mtl|cyp|sit|skk|eek|lvl|ltl)/gi,

        // Standalone numbers near keywords (improved)
        /\b([0-9]{1,6})\b(?=\s*(?:$|\n|total|due|owed|payable|charged|paid))/gi,

        // Numbers with spaces as thousand separators
        /([0-9]{1,3}(?:\s[0-9]{3})*(?:\.[0-9]{1,2})?)(?![0-9])/g,

        // Numbers with dots as thousand separators (European format)
        /([0-9]{1,3}(?:\.[0-9]{3})*,?[0-9]{1,2})(?![0-9])/g,

        // Numbers in parentheses (sometimes used for totals)
        /\(([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)\)/g,

        // Numbers with colon separator (invoice format)
        /:\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,

        // Numbers after equals sign
        /=\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/g,

        // Simple whole numbers (last resort)
        /\b([0-9]{2,6})\b/g,
      ];

      for (const src of patterns) {
        // clone RegExp to reset lastIndex in while-loop
        const pattern = new RegExp(src);
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(srcLine))) {
          const amtString = (m[1] ?? m[0]).replace(/[$,\s€£¥₹₩]/g, "");
          const amt = parseFloat(amtString);
          if (isNaN(amt) || amt <= 0 || amt >= 100_000) continue;

          let conf = 1;

          // Higher confidence for exact total keywords
          if (
            [
              "total",
              "grandtotal",
              "totalamount",
              "invoicetotal",
              "invoicevalue",
              "totalvalue",
            ].includes(matchedKeyword)
          ) {
            conf += 3;
          } else if (
            [
              "balancedue",
              "amountdue",
              "totaldue",
              "amountpayable",
              "netpayable",
              "payablenow",
              "paynow",
            ].includes(matchedKeyword)
          ) {
            conf += 2.5;
          } else if (
            [
              "subtotal",
              "netamount",
              "finalamount",
              "grossamount",
              "totalinclusive",
              "amountinclusive",
            ].includes(matchedKeyword)
          ) {
            conf += 2;
          } else if (
            [
              "paymentamount",
              "settlementamount",
              "finalpayment",
              "totalpayment",
              "remit",
              "remittance",
            ].includes(matchedKeyword)
          ) {
            conf += 1.8;
          }

          // Bonus for same line as keyword
          if (j === 0) conf += 1.5;

          // Bonus for currency symbols
          if (/[.$€£¥₹₩]/.test(m[0])) conf += 1;

          // Extra bonus for amounts in parentheses or after colons/equals
          if (/[\(\):=]/.test(m[0])) conf += 0.3;

          // Bonus for proper decimal format
          if (/\.[0-9]{2}$/.test(amtString)) conf += 0.5;

          // Penalty for very small amounts
          if (amt < 1) conf -= 1;

          // Bonus for reasonable invoice amounts
          if (amt >= 10 && amt <= 10000) conf += 0.5;

          // Penalty for amounts that are too close to line numbers or dates
          if (amt < 100 && /^[0-9]{1,2}$/.test(amtString)) conf -= 0.5;

          amountCandidates.push({
            amount: amt,
            confidence: conf,
            keyword: matchedKeyword,
            lineIndex: i + j,
          });
        }
      }
    }
  }

  /* ---------- 3.4  Fallback (largest reasonable number) ---------- */
  if (!amountCandidates.length) {
    lines.forEach((src, idx) => {
      // Enhanced fallback patterns
      const fallbackPatterns = [
        /\$?([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{2})/g,
        /\$?([0-9]{1,3}(?:,?[0-9]{3})*\.[0-9]{1})/g,
        /\$?([0-9]{1,3}(?:,?[0-9]{3})+)/g,
        /([0-9]+\.[0-9]{2})/g,
      ];

      fallbackPatterns.forEach((pattern) => {
        const matches = src.match(pattern);
        matches?.forEach((raw) => {
          const n = parseFloat(raw.replace(/[$,]/g, ""));
          if (n >= 1 && n < 100_000) {
            let fallbackConf = 0.2;

            // Higher confidence for decimal amounts
            if (/\.[0-9]{2}$/.test(raw)) fallbackConf += 0.2;

            // Higher confidence for larger amounts
            if (n >= 10) fallbackConf += 0.1;
            if (n >= 100) fallbackConf += 0.1;

            // Lower confidence for very small amounts
            if (n < 5) fallbackConf -= 0.1;

            amountCandidates.push({
              amount: n,
              confidence: fallbackConf,
              keyword: "fallback",
              lineIndex: idx,
            });
          }
        });
      });
    });
  }

  const bestAmt = amountCandidates.sort(
    (a, b) => b.confidence - a.confidence,
  )[0];
  const amount = bestAmt ? bestAmt.amount.toFixed(2) : "";

  /* ---------- 3.5  VENDOR ---------- */
  let vendor = "";
  if (!selectedArea) {
    const vendorCands: { text: string; c: number }[] = [];
    lines.slice(0, 8).forEach((raw, idx) => {
      const txt = raw.trim();
      if (
        txt.length < 3 ||
        /^[0-9\s\-\/\.,:]+$/.test(txt) ||
        /^(receipt|invoice|bill|thank you|thanks|welcome)$/i.test(txt)
      )
        return;
      let c = 1;
      if (VENDOR_INDICATORS.some((v) => txt.toLowerCase().includes(v))) c += 2;
      if (/[a-z]/.test(txt) && /[A-Z]/.test(txt)) c += 1;
      if (txt.length > 8 && txt.length <= 50) c += 1;
      c -= idx * 0.2;
      vendorCands.push({ text: txt, c });
    });
    vendor =
      vendorCands.sort((a, b) => b.c - a.c)[0]?.text ??
      lines
        .find(
          (l, i) =>
            i < 8 &&
            l.trim().length > 3 &&
            !/^[0-9\s\-\/\.,:]+$/.test(l.trim()),
        )
        ?.trim() ??
      "";
  }

  /* ------------------------------------------------------------------------ */
  /*   PDF → IMAGE helper                                                     */
  /* ------------------------------------------------------------------------ */
  async function pdfFirstPageToPNG(file: File): Promise<File> {
    // Dynamic import keeps pdfjs out of the main bundle until needed
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    // Let pdfjs know where to find the worker; tweak for your build setup
    pdfjs.GlobalWorkerOptions.workerSrc =
      "//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdfData = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await pdfjs.getDocument({ data: pdfData }).promise;
    const page = await pdfDoc.getPage(1);

    const scale = 2; // 2× for better OCR clarity
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/png"),
    );
    if (!blob) throw new Error("PDF to PNG conversion failed");

    return new File([blob], file.name.replace(/\.pdf$/i, ".png"), {
      type: "image/png",
    });
  }

  /* ---------- 3.6  DATE ---------- */
  const datePatterns = [
    /\b(20\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/,
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]20\d{2})\b/,
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}\b/i,
  ];
  let date = "";
  if (!selectedArea) {
    for (const p of datePatterns) {
      const m = data.text.match(p);
      if (m) {
        const d = new Date(m[0]);
        if (!isNaN(d.valueOf()) && d.getFullYear() > 2000) {
          date = d.toISOString().split("T")[0];
          break;
        }
      }
    }
    if (!date) date = new Date().toISOString().split("T")[0];
  }

  return { amount, vendor, date, category: "" };
}

/* ------------------------------------------------------------------------ */
/* 4. CROPPER HELPER                                                        */
/* ------------------------------------------------------------------------ */

async function cropImageToSelectedArea(
  file: File,
  {
    x,
    y,
    width,
    height,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
  }: any,
): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = img.naturalWidth / displayWidth;
      const sy = img.naturalHeight / displayHeight;
      const canvas = document.createElement("canvas");
      canvas.width = width * sx;
      canvas.height = height * sy;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context error"));

      ctx.drawImage(
        img,
        x * sx,
        y * sy,
        width * sx,
        height * sy,
        0,
        0,
        width * sx,
        height * sy,
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Cropping failed"));
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, ".png"), {
              type: "image/png",
            }),
          );
        },
        "image/png",
        1,
      );
    };
    img.onerror = (e) => reject(e);
    img.src = URL.createObjectURL(file);
  });
}
