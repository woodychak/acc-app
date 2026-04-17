"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  X,
  History,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  FileText,
  Crop,
  RotateCcw,
  Eye,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import { createClient } from "@/lib/client";
import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const EXPENSE_CATEGORIES = [
  "Auto-detect",
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Professional Services",
  "Equipment",
  "Utilities",
  "Rent",
  "Insurance",
  "Other",
];

interface ImportRecord {
  id: string;
  file_name: string;
  month: number;
  year: number;
  status: string;
  total_transactions: number;
  imported_count: number;
  created_at: string;
}

interface ParsedPreview {
  date: string;
  description: string;
  amount: number;
  category: string;
}

interface PdfPage {
  pageNum: number;
  canvasDataUrl: string;
  viewport: { width: number; height: number; scale: number };
  // raw pdfjs page ref for re-extraction
  textItems: Array<{ str: string; transform: number[]; width: number; height: number }>;
}

interface SelectionRect {
  x: number; // 0-1 normalized
  y: number;
  w: number;
  h: number;
}

export default function BankStatementPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [pdfText, setPdfText] = useState<string>("");
  const [fileType, setFileType] = useState<"csv" | "pdf" | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [defaultCategory, setDefaultCategory] = useState("Auto-detect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    imported?: number;
    skipped?: number;
    total?: number;
    message?: string;
    error?: string;
    aiParsed?: boolean;
  } | null>(null);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewRows, setPreviewRows] = useState<ParsedPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF region selector state
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [regionSelections, setRegionSelections] = useState<Record<number, SelectionRect>>({});
  const [applyToAllPages, setApplyToAllPages] = useState(true);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<SelectionRect | null>(null);
  const containerRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/sign-in"; return; }

      const { data: company } = await supabase
        .from("company_profile")
        .select("default_currency")
        .eq("user_id", user.id)
        .single();
      if (company?.default_currency) setDefaultCurrency(company.default_currency);

      const { data: history } = await supabase
        .from("bank_statement_imports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (history) setImports(history);
      setLoadingHistory(false);
    };
    init();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const processFile = async (f: File) => {
    const isPdf = f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf";
    const isCsv = f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".txt");

    if (!isPdf && !isCsv) {
      alert("Please upload a CSV (.csv, .txt) or PDF (.pdf) file");
      return;
    }

    setFile(f);
    setResult(null);
    setCsvContent("");
    setPdfText("");
    setPdfPages([]);
    setRegionSelections({});
    setShowRegionSelector(false);

    if (isPdf) {
      setFileType("pdf");
      setPdfLoading(true);
      try {
        const arrayBuffer = await f.arrayBuffer();
        // @ts-ignore pdfjs-dist has no types for the root entry
        const pdfjs: any = await import("pdfjs-dist");
        const { getDocument, GlobalWorkerOptions } = pdfjs;
        if (!GlobalWorkerOptions.workerSrc) {
          GlobalWorkerOptions.workerSrc =
            "https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs";
        }
        const pdf = await getDocument({ data: arrayBuffer }).promise;

        const pages: PdfPage[] = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          // Render page to canvas
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/png");

          // Extract text items with positions
          const textContent = await page.getTextContent();
          const items = textContent.items.map((item: any) => ({
            str: item.str || "",
            transform: item.transform,
            width: item.width,
            height: item.height,
          }));

          pages.push({
            pageNum,
            canvasDataUrl: dataUrl,
            viewport: { width: viewport.width, height: viewport.height, scale },
            textItems: items,
          });
        }

        setPdfPages(pages);

        // Extract full text with proper line reconstruction based on Y position
        const fullText = reconstructTextFromPages(pages, null, false);
        setPdfText(fullText);
        generatePreviewFromText(fullText);
        setShowRegionSelector(true);
      } catch (err) {
        console.error("PDF parse error:", err);
        alert("Failed to read PDF. Please try a different file.");
        clearFile();
      } finally {
        setPdfLoading(false);
      }
    } else {
      setFileType("csv");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setCsvContent(content);
        generatePreview(content);
      };
      reader.readAsText(f);
    }
  };

  /**
   * Reconstruct structured text lines from PDF text items.
   * Groups items by Y position (row) and sorts each row by X position,
   * then joins rows with newlines — preserving the tabular layout of bank statements.
   */
  const reconstructLines = (
    items: Array<{ str: string; transform: number[]; width: number; height: number }>,
    filterRect?: { xMin: number; xMax: number; yMin: number; yMax: number } | null
  ): string => {
    let filtered = filterRect
      ? items.filter((item) => {
          const tx = item.transform[4];
          const ty = item.transform[5];
          return tx >= filterRect.xMin && tx <= filterRect.xMax && ty >= filterRect.yMin && ty <= filterRect.yMax;
        })
      : items;

    if (filtered.length === 0) return "";

    // Group by rounded Y coordinate (PDF units are bottom-up)
    const lineMap: Record<number, Array<{ x: number; str: string }>> = {};
    const LINE_TOLERANCE = 4; // points — items within 4pts share a line

    for (const item of filtered) {
      if (!item.str.trim()) continue;
      const ty = item.transform[5];
      const tx = item.transform[4];

      // Find existing bucket within tolerance
      let bucket = Object.keys(lineMap).find(
        (k) => Math.abs(parseFloat(k) - ty) <= LINE_TOLERANCE
      );
      if (bucket === undefined) {
        lineMap[ty] = [];
        bucket = String(ty);
      }
      lineMap[parseFloat(bucket)] = lineMap[parseFloat(bucket)] || [];
      lineMap[parseFloat(bucket)].push({ x: tx, str: item.str });
    }

    // Sort lines by Y descending (top of page first in PDF bottom-up coords)
    const sortedYs = Object.keys(lineMap)
      .map(Number)
      .sort((a, b) => b - a);

    return sortedYs
      .map((y) =>
        lineMap[y]
          .sort((a, b) => a.x - b.x)
          .map((t) => t.str)
          .join("  ")
      )
      .join("\n");
  };

  const reconstructTextFromPages = (
    pages: PdfPage[],
    sels: Record<number, SelectionRect> | null,
    useApplyToAll: boolean
  ): string => {
    return pages
      .map((page) => {
        const sel = sels
          ? sels[page.pageNum] || (useApplyToAll ? sels[1] : null)
          : null;

        let filterRect: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null;
        if (sel && sel.w > 0.01 && sel.h > 0.01) {
          const vw = page.viewport.width / page.viewport.scale;
          const vh = page.viewport.height / page.viewport.scale;
          filterRect = {
            xMin: sel.x * vw,
            xMax: (sel.x + sel.w) * vw,
            yMin: (1 - sel.y - sel.h) * vh,
            yMax: (1 - sel.y) * vh,
          };
        }

        return reconstructLines(page.textItems, filterRect);
      })
      .join("\n---PAGE BREAK---\n");
  };

  // Extract text from pages using region selections
  const extractTextWithRegions = useCallback(() => {
    if (pdfPages.length === 0) return "";
    return reconstructTextFromPages(pdfPages, regionSelections, applyToAllPages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPages, regionSelections, applyToAllPages]);

  const generatePreview = (content: string) => {
    try {
      const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) return;
      const preview: ParsedPreview[] = [];

      // Detect column indices from header row
      const DEBIT_COLS = ["debit", "withdrawal", "debit amount", "amount out", "dr", "charge", "payment"];
      const DATE_COLS = ["date", "transaction date", "trans date", "value date", "posting date"];
      const DESC_COLS = ["description", "narrative", "details", "particulars", "memo", "transaction", "reference"];
      const AMOUNT_COLS = ["amount", "transaction amount", "net amount"];

      const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());

      let dateIdx = headers.findIndex((h) => DATE_COLS.includes(h));
      let descIdx = headers.findIndex((h) => DESC_COLS.includes(h));
      let debitIdx = headers.findIndex((h) => DEBIT_COLS.includes(h));
      let amountIdx = headers.findIndex((h) => AMOUNT_COLS.includes(h));

      // Fallback to positional
      if (dateIdx === -1) dateIdx = 0;
      if (descIdx === -1) descIdx = 1;
      const amtColIdx = debitIdx !== -1 ? debitIdx : amountIdx !== -1 ? amountIdx : 2;

      for (let i = 1; i < Math.min(lines.length, 101); i++) {
        const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
        if (cols.length < 2) continue;
        const rawAmt = cols[amtColIdx]?.replace(/[,$\s]/g, "") || "0";
        const parsedAmt = parseFloat(rawAmt) || 0;
        if (parsedAmt <= 0) continue; // skip credits/zero in preview
        preview.push({
          date: cols[dateIdx] || "-",
          description: cols[descIdx] || "-",
          amount: Math.abs(parsedAmt),
          category: "Other",
        });
      }
      setPreviewRows(preview);
      setShowPreview(true);
    } catch {}
  };

  const generatePreviewFromText = (text: string) => {
    try {
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
      const preview: ParsedPreview[] = [];
      const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/;
      const amountRegex = /\d{1,3}(?:[,]\d{3})*(?:\.\d{2})/;

      for (const line of lines) {
        if (preview.length >= 100) break;
        const dateMatch = line.match(dateRegex);
        const amountMatch = line.match(amountRegex);
        if (!dateMatch) continue;
        const amtStr = amountMatch ? amountMatch[0].replace(/,/g, "") : "0";
        const desc = line
          .replace(dateMatch[0], "")
          .replace(amountMatch ? amountMatch[0] : "", "")
          .replace(/\s+/g, " ")
          .trim();
        preview.push({
          date: dateMatch[0],
          description: desc || "-",
          amount: parseFloat(amtStr) || 0,
          category: "Other",
        });
      }
      setPreviewRows(preview);
      setShowPreview(true);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!file || (!csvContent && !pdfText)) return;
    // Show confirmation dialog instead of immediately submitting
    setShowConfirmDialog(true);
  };

  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);
    if (!file || (!csvContent && !pdfText)) return;
    setLoading(true);
    setResult(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // For PDFs with region selections, re-extract filtered text
      const effectivePdfText = fileType === "pdf" && pdfPages.length > 0
        ? extractTextWithRegions()
        : pdfText;

      // Create import record
      const { data: importRecord } = await supabase
        .from("bank_statement_imports")
        .insert({
          user_id: session.user.id,
          file_name: file.name,
          month: parseInt(selectedMonth),
          year: parseInt(selectedYear),
          status: "processing",
        })
        .select()
        .single();

      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-parse-bank-statement",
        {
          body: {
            csvContent: fileType === "csv" ? csvContent : undefined,
            pdfText: fileType === "pdf" ? effectivePdfText : undefined,
            fileType,
            month: selectedMonth,
            year: selectedYear,
            fileName: file.name,
            importId: importRecord?.id,
            currencyCode: defaultCurrency,
            defaultCategory: defaultCategory === "Auto-detect" ? null : defaultCategory,
          },
        }
      );

      if (error) throw error;
      setResult(data);

      // Show summary popup after processing
      if (data) setShowSummaryDialog(true);

      // Refresh history
      const { data: history } = await supabase
        .from("bank_statement_imports")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (history) setImports(history);
    } catch (err: any) {
      setResult({ success: false, error: err.message || "An unexpected error occurred" });
      setShowSummaryDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setCsvContent("");
    setPdfText("");
    setFileType(null);
    setPreviewRows([]);
    setShowPreview(false);
    setResult(null);
    setPdfPages([]);
    setRegionSelections({});
    setShowRegionSelector(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const monthName = (m: number) => MONTHS.find((mo) => mo.value === String(m))?.label || m;

  // Mouse handlers for PDF region drawing
  const getRelativePos = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    const container = containerRefs.current[pageNum];
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    e.preventDefault();
    const pos = getRelativePos(e, pageNum);
    if (!pos) return;
    setDrawingPage(pageNum);
    setDrawStart(pos);
    setCurrentDraw(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (drawingPage !== pageNum || !drawStart) return;
    const pos = getRelativePos(e, pageNum);
    if (!pos) return;
    setCurrentDraw({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (drawingPage !== pageNum || !drawStart) return;
    const pos = getRelativePos(e, pageNum);
    if (!pos) return;
    const rect: SelectionRect = {
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    };
    if (rect.w > 0.02 && rect.h > 0.02) {
      const newSels = { ...regionSelections, [pageNum]: rect };
      setRegionSelections(newSels);
      // Re-extract preview with new selection using structured line reconstruction
      const filtered = reconstructTextFromPages(pdfPages, newSels, applyToAllPages);
      setPdfText(filtered);
      generatePreviewFromText(filtered);
    }
    setDrawingPage(null);
    setDrawStart(null);
    setCurrentDraw(null);
  };

  const clearPageSelection = (pageNum: number) => {
    const next = { ...regionSelections };
    delete next[pageNum];
    setRegionSelections(next);
    // Reset to full structured text
    const fullText = reconstructTextFromPages(pdfPages, next, applyToAllPages);
    setPdfText(fullText);
    generatePreviewFromText(fullText);
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full bg-white min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Bank Statement Import</h1>
              <p className="text-muted-foreground">
                Upload a CSV bank statement and automatically create expenses from your payouts
              </p>
            </div>
            <Link href="/dashboard/expenses">
              <Button variant="outline">View Expenses</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main upload card */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    Import Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Month / Year selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Month</Label>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Year</Label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Currency & Category */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Input
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
                        placeholder="USD"
                        maxLength={3}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default Category</Label>
                      <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* File upload area */}
                  <div className="space-y-1.5">
                    <Label>Bank Statement File</Label>
                    {!file ? (
                      <div
                        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                          dragOver
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-primary hover:bg-gray-50"
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-sm font-medium text-gray-700">
                          Drag & drop your bank statement here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports CSV (.csv, .txt) and PDF (.pdf) formats
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.txt,.pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${fileType === "pdf" ? "bg-red-100" : "bg-green-100"}`}>
                            {fileType === "pdf" ? (
                              <FileText className="h-5 w-5 text-red-600" />
                            ) : (
                              <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                              {pdfLoading && " · Extracting text from PDF..."}
                              {!pdfLoading && fileType === "pdf" && pdfText && ` · PDF ready`}
                              {!pdfLoading && fileType === "csv" && csvContent && ` · ${csvContent.split("\n").length - 1} rows`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={clearFile}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                    {pdfLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Reading PDF and extracting transaction data...
                      </div>
                    )}
                    {/* PDF Region Selector button */}
                    {!pdfLoading && fileType === "pdf" && pdfPages.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRegionSelector(true)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Crop className="h-3.5 w-3.5" />
                          {Object.keys(regionSelections).length > 0
                            ? "Edit Transaction Region"
                            : "Select Transaction Area"}
                        </Button>
                        {Object.keys(regionSelections).length > 0 && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Region selected — noise filtered
                          </span>
                        )}
                        {Object.keys(regionSelections).length === 0 && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Optional: select area to reduce noise
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  {showPreview && previewRows.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 text-sm font-medium hover:bg-gray-100 transition-colors"
                        onClick={() => setShowPreview((p) => !p)}
                      >
                        <span>
                          {fileType === "pdf" ? "PDF Preview" : "CSV Preview"} (first rows)
                          {fileType === "pdf" && Object.keys(regionSelections).length > 0 && (
                            <span className="ml-2 text-xs text-green-600 font-normal">· filtered by region</span>
                          )}
                        </span>
                        {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showPreview && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-3 py-2 text-left">Col 1 (Date?)</th>
                                <th className="px-3 py-2 text-left">Col 2 (Description?)</th>
                                <th className="px-3 py-2 text-left">Col 3 (Amount?)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.map((row, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-1.5 text-gray-600">{row.date}</td>
                                  <td className="px-3 py-1.5 text-gray-600 max-w-[200px] truncate">{row.description}</td>
                                  <td className="px-3 py-1.5 text-gray-600">{row.amount || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Result */}
                  {result && (
                    <Alert variant={result.success ? "default" : "destructive"}>
                      {result.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>{result.success ? "Import Successful" : "Import Failed"}</AlertTitle>
                      <AlertDescription>
                        {result.success ? (
                          <div className="space-y-1">
                            <p>{result.message}</p>
                            <div className="flex gap-4 text-xs mt-2">
                              <span className="text-green-700">✓ Imported: {result.imported}</span>
                              <span className="text-gray-500">⊘ Skipped: {result.skipped}</span>
                              <span className="text-gray-500">Total rows: {result.total}</span>
                            </div>
                            <Link href="/dashboard/expenses" className="text-sm text-blue-600 hover:underline block mt-1">
                              View imported expenses →
                            </Link>
                          </div>
                        ) : (
                          <p>{result.error}</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Submit */}
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!file || loading || pdfLoading || (!csvContent && !pdfText)}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Statement...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Expenses for {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* How it works */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    How it works
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <p>1. Export your bank statement as a <strong>CSV</strong> or <strong>PDF</strong> from your online banking portal.</p>
                  <p>2. Select the <strong>month and year</strong> you want to import.</p>
                  <p>3. Upload the file — the system automatically extracts transactions.</p>
                  <p>4. Only <strong>debit / payout</strong> transactions are imported as expenses.</p>
                  <p>5. Categories are auto-detected from the transaction description.</p>
                </CardContent>
              </Card>

              {/* Supported formats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-500" />
                    Supported Formats
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <div>
                    <span className="font-medium text-gray-700">PDF:</span>{" "}
                    Any bank-generated PDF statement. Text is extracted automatically.
                  </div>
                  <div className="border-t pt-2">
                    <p className="font-medium text-gray-700 mb-1">CSV Columns:</p>
                    <div><span className="font-medium text-gray-600">Date:</span> date, transaction date, value date</div>
                    <div><span className="font-medium text-gray-600">Description:</span> description, narrative, details, memo</div>
                    <div><span className="font-medium text-gray-600">Amount:</span> debit, withdrawal, amount, charge</div>
                  </div>
                </CardContent>
              </Card>

              {/* Import History */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-500" />
                    Import History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : imports.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No imports yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {imports.map((imp) => (
                        <div key={imp.id} className="border rounded-md p-2 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate max-w-[120px]" title={imp.file_name}>
                              {imp.file_name}
                            </span>
                            <Badge
                              variant={imp.status === "completed" ? "default" : imp.status === "failed" ? "destructive" : "secondary"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {imp.status}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground">
                            {monthName(imp.month)} {imp.year}
                            {imp.imported_count > 0 && (
                              <span className="ml-2 text-green-600">· {imp.imported_count} imported</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* PDF Region Selector Dialog */}
      <Dialog open={showRegionSelector} onOpenChange={setShowRegionSelector}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-primary" />
              Select Transaction Area
            </DialogTitle>
            <DialogDescription>
              Draw a rectangle on the PDF page to select only the area containing transactions. This filters out headers, footers, and other noise.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-2 border-b text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToAllPages}
                onChange={(e) => setApplyToAllPages(e.target.checked)}
                className="rounded"
              />
              Apply first-page selection to all pages
            </label>
            {Object.keys(regionSelections).length > 0 && (
              <button
                onClick={() => {
                  setRegionSelections({});
                  const fullText = reconstructTextFromPages(pdfPages, {}, applyToAllPages);
                  setPdfText(fullText);
                  generatePreviewFromText(fullText);
                }}
                className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all selections
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 space-y-6 py-2">
            {pdfPages.map((page) => {
              const sel = regionSelections[page.pageNum] || (applyToAllPages && regionSelections[1]);
              const isDrawingThisPage = drawingPage === page.pageNum;
              const activeDraw = isDrawingThisPage ? currentDraw : null;
              const displaySel = activeDraw || sel;

              return (
                <div key={page.pageNum}>
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span className="text-xs font-medium text-gray-500">Page {page.pageNum}</span>
                    {regionSelections[page.pageNum] && (
                      <button
                        onClick={() => clearPageSelection(page.pageNum)}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    )}
                  </div>
                  <div
                    ref={(el) => { containerRefs.current[page.pageNum] = el; }}
                    className="relative border rounded-lg overflow-hidden cursor-crosshair select-none"
                    style={{ userSelect: "none" }}
                    onMouseDown={(e) => handleMouseDown(e, page.pageNum)}
                    onMouseMove={(e) => handleMouseMove(e, page.pageNum)}
                    onMouseUp={(e) => handleMouseUp(e, page.pageNum)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.canvasDataUrl}
                      alt={`Page ${page.pageNum}`}
                      className="w-full block pointer-events-none"
                      draggable={false}
                    />
                    {/* Overlay dim */}
                    {displaySel && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Top dim */}
                        <div
                          className="absolute bg-black/30"
                          style={{
                            top: 0,
                            left: 0,
                            right: 0,
                            height: `${displaySel.y * 100}%`,
                          }}
                        />
                        {/* Bottom dim */}
                        <div
                          className="absolute bg-black/30"
                          style={{
                            top: `${(displaySel.y + displaySel.h) * 100}%`,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        />
                        {/* Left dim */}
                        <div
                          className="absolute bg-black/30"
                          style={{
                            top: `${displaySel.y * 100}%`,
                            left: 0,
                            width: `${displaySel.x * 100}%`,
                            height: `${displaySel.h * 100}%`,
                          }}
                        />
                        {/* Right dim */}
                        <div
                          className="absolute bg-black/30"
                          style={{
                            top: `${displaySel.y * 100}%`,
                            left: `${(displaySel.x + displaySel.w) * 100}%`,
                            right: 0,
                            height: `${displaySel.h * 100}%`,
                          }}
                        />
                        {/* Selection border */}
                        <div
                          className="absolute border-2 border-blue-500"
                          style={{
                            top: `${displaySel.y * 100}%`,
                            left: `${displaySel.x * 100}%`,
                            width: `${displaySel.w * 100}%`,
                            height: `${displaySel.h * 100}%`,
                          }}
                        >
                          <div className="absolute top-0 left-0 bg-blue-500 text-white text-[9px] px-1 py-0.5 leading-none">
                            Transaction area
                          </div>
                        </div>
                      </div>
                    )}
                    {!displaySel && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                          <Crop className="h-3 w-3" />
                          Drag to select transaction area
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowRegionSelector(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Apply current selections
                if (Object.keys(regionSelections).length > 0 || pdfPages.length > 0) {
                  const filtered = extractTextWithRegions();
                  if (filtered) {
                    setPdfText(filtered);
                    generatePreviewFromText(filtered);
                  }
                }
                setShowRegionSelector(false);
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              Apply Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Confirm Import
            </DialogTitle>
            <DialogDescription>
              Review the scan results and import details before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Import summary */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File</span>
                <span className="font-medium truncate max-w-[280px]">{file?.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">
                  {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">{defaultCurrency}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Default Category</span>
                <span className="font-medium">{defaultCategory}</span>
              </div>
              {previewRows.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Detected transactions</span>
                    <span className="font-medium text-blue-600">{previewRows.length} transactions</span>
                  </div>
                </>
              )}
              {fileType === "pdf" && Object.keys(regionSelections).length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Region filter</span>
                    <span className="font-medium text-green-600 flex items-center gap-1">
                      <Crop className="h-3 w-3" />
                      Active ({Object.keys(regionSelections).length} page{Object.keys(regionSelections).length > 1 ? "s" : ""})
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Scan result table — withdrawal column */}
            {previewRows.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-gray-700">Transactions to Import</span>
                  <Badge variant="secondary" className="text-xs">{previewRows.length} transactions</Badge>
                  {fileType === "pdf" && (
                    <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">AI Parsed</Badge>
                  )}
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-y-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-100 border-b">
                          <th className="px-3 py-2 text-left font-medium text-gray-600 w-8">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-red-600">
                            <span className="flex items-center justify-end gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Amount
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{row.date}</td>
                            <td className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate" title={row.description}>{row.description}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-red-600 whitespace-nowrap tabular-nums">
                              {defaultCurrency} {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0">
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-600">
                            Total ({previewRows.length} transaction{previewRows.length !== 1 ? "s" : ""})
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-red-700 tabular-nums">
                            {defaultCurrency}{" "}
                            {previewRows
                              .reduce((sum, r) => sum + r.amount, 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                {fileType === "csv" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Only debit/withdrawal transactions with a positive amount are shown.
                  </p>
                )}
                {fileType === "pdf" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Preview extracted from PDF text. Final count may vary after AI parsing.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Only debit/withdrawal transactions will be imported as expenses. This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport}>
              <Upload className="mr-2 h-4 w-4" />
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              {result?.success ? "Import Complete" : "Import Failed"}
              {result?.success && result?.aiParsed && (
                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200 ml-1">AI Parsed</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {result?.success
                ? `Bank statement for ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear} has been processed.`
                : "There was a problem processing your bank statement."}
            </DialogDescription>
          </DialogHeader>

          {result?.success ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.imported ?? 0}</p>
                  <p className="text-xs text-green-600 mt-0.5">Imported</p>
                </div>
                <div className="rounded-lg bg-gray-50 border p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600">{result.skipped ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.total ?? 0}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Total Rows</p>
                </div>
              </div>
              {result.message && (
                <p className="text-sm text-muted-foreground">{result.message}</p>
              )}
            </div>
          ) : (
            <div className="py-2">
              <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                {result?.error || "An unexpected error occurred."}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {result?.success && (
              <Link href="/dashboard/expenses">
                <Button variant="outline">
                  View Expenses →
                </Button>
              </Link>
            )}
            <Button onClick={() => setShowSummaryDialog(false)}>
              {result?.success ? "Done" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
