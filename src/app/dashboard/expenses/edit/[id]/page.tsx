"use client";

import DashboardNavbar from "@/components/dashboard-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import { createClient } from "../../../../../../supabase/client";
import { useRouter, useParams } from "next/navigation";
import { updateExpenseAction } from "../../actions";
import { extractReceiptData } from "@/lib/receipt-ocr";
import { pdfPageToPng } from "@/lib/pdf-to-image";

const EXPENSE_CATEGORIES = [
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

const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Bank Transfer",
  "Check",
  "Digital Wallet",
];
type ExtractedReceiptData = {
  amount?: string;
  vendor?: string;
  date?: string;
  category?: string;
};

type ReceiptFileData = {
  file: File;
  preview: string;
  id: string;
};

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<ReceiptFileData[]>([]);
  const [existingReceiptUrls, setExistingReceiptUrls] = useState<string[]>([]);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [aiExtractedData, setAiExtractedData] =
    useState<ExtractedReceiptData | null>(null);
  const [error, setError] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedArea, setSelectedArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    displayWidth: number;
    displayHeight: number;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const skipNextClickRef = useRef(false);
  const [currencies, setCurrencies] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      symbol: string;
      is_default: boolean;
    }>
  >([]);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    amount: string;
    currency_code: string;
    category: string;
    expense_date: string;
    payment_method: string;
    vendor: string;
    is_reimbursable: boolean;
    notes: string;
  }>({
    title: "",
    description: "",
    amount: "",
    currency_code: "USD",
    category: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "",
    vendor: "",
    is_reimbursable: false,
    notes: "",
  });
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);

  type FormField = keyof typeof formData;

  useEffect(() => {
    if (!selectedArea || !receiptFiles.length) return;

    (async () => {
      setAiProcessing(true);
      try {
        // Convert selectedArea to include legacy fields
        const areaWithLegacyFields = {
          ...selectedArea,
          imageWidth: selectedArea.displayWidth,
          imageHeight: selectedArea.displayHeight,
        };

        const { amount } = await extractReceiptData(
          receiptFiles[0].file,
          areaWithLegacyFields,
        );
        if (amount) {
          setFormData((p) => ({ ...p, amount }));
          setAiExtractedData((p) => ({ ...p, amount }));
        } else {
          setError("Couldn't find a number in the selected area.");
        }
      } catch (err) {
        console.error("Area OCR failed", err);
        setError("Failed to read the selected area.");
      } finally {
        setAiProcessing(false);
      }
    })();
  }, [selectedArea, receiptFiles]);

  const handleImageMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelecting) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionStart({ x, y });
    setIsDrawing(true);
    setSelectedArea(null);
  };

  const handleImageMouseMove = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>,
  ) => {
    if (!isSelecting || !isDrawing || !selectionStart) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectedArea({
      x: Math.min(selectionStart.x, x),
      y: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y),
      displayWidth: rect.width,
      displayHeight: rect.height,
      naturalWidth: imgNatural.w,
      naturalHeight: imgNatural.h,
    });
  };

  const handleImageMouseUp = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>,
  ) => {
    if (!isSelecting || !isDrawing || !selectionStart) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = Math.abs(x - selectionStart.x);
    const height = Math.abs(y - selectionStart.y);

    if (width > 10 && height > 10) {
      setSelectedArea({
        x: Math.min(selectionStart.x, x),
        y: Math.min(selectionStart.y, y),
        width,
        height,
        displayWidth: rect.width,
        displayHeight: rect.height,
        naturalWidth: imgNatural.w,
        naturalHeight: imgNatural.h,
      });
    } else {
      setSelectedArea(null);
    }

    setIsDrawing(false);
    setIsSelecting(false);
    setSelectionStart(null);
    skipNextClickRef.current = true;
  };

  const startAreaSelection = () => {
    setIsSelecting(true);
    setSelectedArea(null);
    setError("");
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newReceiptFiles: ReceiptFileData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      /* Validate type & size */
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        setError("Please select only image or PDF files");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 20 MB)`);
        continue;
      }

      /* Generate preview + OCR source */
      let ocrFile: File;
      let previewUrl: string;

      if (isPdf) {
        const pngBlob = await pdfPageToPng(file);
        ocrFile = new File([pngBlob], file.name + ".png", { type: "image/png" });
        previewUrl = URL.createObjectURL(pngBlob);
      } else {
        // Compress image files
        ocrFile = await compressImage(file);
        previewUrl = URL.createObjectURL(ocrFile);
      }

      newReceiptFiles.push({
        file: ocrFile,
        preview: previewUrl,
        id: `${Date.now()}-${i}`,
      });
    }

    setReceiptFiles((prev) => [...prev, ...newReceiptFiles]);

    // Process first new file with OCR
    if (newReceiptFiles.length > 0) {
      const totalFiles = receiptFiles.length + existingReceiptUrls.length;
      setReceiptPreview(newReceiptFiles[0].preview);
      setCurrentReceiptIndex(totalFiles);
      
      setAiProcessing(true);
      try {
        const extractedData = await extractReceiptData(newReceiptFiles[0].file);
        setAiExtractedData(extractedData);
        setFormData((prev) => ({
          ...prev,
          amount: extractedData.amount || prev.amount,
          vendor: extractedData.vendor || prev.vendor,
          expense_date: extractedData.date || prev.expense_date,
          category: extractedData.category || prev.category,
          title: extractedData.vendor
            ? `Expense from ${extractedData.vendor}`
            : prev.title,
        }));
      } catch (error) {
        console.error("OCR processing failed:", error);
        setError("Failed to process receipt. Please enter details manually.");
      } finally {
        setAiProcessing(false);
      }
    }

    // Reset selection states
    setSelectedArea(null);
    setIsSelecting(false);
    setIsDrawing(false);
    setSelectionStart(null);
  };

  const removeReceiptFile = (id: string) => {
    setReceiptFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      
      // Update preview if we removed the current one
      const removedIndex = prev.findIndex((f) => f.id === id);
      if (currentReceiptIndex === existingReceiptUrls.length + removedIndex) {
        const totalRemaining = existingReceiptUrls.length + filtered.length;
        if (totalRemaining > 0) {
          if (existingReceiptUrls.length > 0) {
            setReceiptPreview(existingReceiptUrls[0]);
            setCurrentReceiptIndex(0);
          } else if (filtered.length > 0) {
            setReceiptPreview(filtered[0].preview);
            setCurrentReceiptIndex(existingReceiptUrls.length);
          }
        } else {
          setReceiptPreview(null);
          setCurrentReceiptIndex(0);
        }
      }
      
      return filtered;
    });
  };

  const removeExistingReceipt = (index: number) => {
    setExistingReceiptUrls((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      
      // Update preview if we removed the current one
      if (currentReceiptIndex === index) {
        if (filtered.length > 0) {
          setReceiptPreview(filtered[0]);
          setCurrentReceiptIndex(0);
        } else if (receiptFiles.length > 0) {
          setReceiptPreview(receiptFiles[0].preview);
          setCurrentReceiptIndex(filtered.length);
        } else {
          setReceiptPreview(null);
          setCurrentReceiptIndex(0);
        }
      }
      
      return filtered;
    });
  };

  const selectReceiptFile = (index: number) => {
    const totalExisting = existingReceiptUrls.length;
    
    if (index < totalExisting) {
      // Selecting an existing receipt
      setReceiptPreview(existingReceiptUrls[index]);
      setCurrentReceiptIndex(index);
    } else {
      // Selecting a new receipt
      const newIndex = index - totalExisting;
      if (receiptFiles[newIndex]) {
        setReceiptPreview(receiptFiles[newIndex].preview);
        setCurrentReceiptIndex(index);
      }
    }
    
    setSelectedArea(null);
    setIsSelecting(false);
  };

  useEffect(() => {
    const fetchExpense = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/sign-in";
        return;
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .eq("user_id", user.id)
        .single();

      // Get currencies for the current user
      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currenciesData || []);

      if (error) {
        setError("Expense not found");
        setPageLoading(false);
        return;
      }

      if (data) {
        setFormData({
          title: data.title || "",
          description: data.description || "",
          amount: data.amount?.toString() || "",
          currency_code: data.currency_code || "USD",
          category: data.category || "",
          expense_date:
            data.expense_date || new Date().toISOString().split("T")[0],
          payment_method: data.payment_method || "",
          vendor: data.vendor || "",
          is_reimbursable: data.is_reimbursable || false,
          notes: data.notes || "",
        });

        // Load existing receipts
        const urls: string[] = [];
        
        if (data.receipt_urls && Array.isArray(data.receipt_urls)) {
          urls.push(...data.receipt_urls);
        } else if (data.receipt_url) {
          urls.push(data.receipt_url);
        }
        
        setExistingReceiptUrls(urls);
        
        if (urls.length > 0) {
          setReceiptPreview(urls[0]);
          setCurrentReceiptIndex(0);
        }

        if (data.ai_extracted_data) {
          setAiExtractedData(data.ai_extracted_data);
        }
      }

      setPageLoading(false);
    };

    if (expenseId) {
      fetchExpense();
    }
  }, [expenseId]);

  const compressImage = async (
    file: File,
    maxWidth = 1200,
    quality = 0.8,
  ): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleInputChange = (field: FormField, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadReceiptToStorage = async (file: File) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    // First, try to remove any existing file with the same name
    await supabase.storage.from("receipts").remove([fileName]);

    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(fileName);

    return { fileName, publicUrl };
  };

  const handleSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const allReceiptUrls = [...existingReceiptUrls];
      const allReceiptFilenames: string[] = [];

      // Upload new receipt files
      if (receiptFiles.length > 0) {
        setUploadingReceipt(true);
        for (const receiptFileData of receiptFiles) {
          const uploadResult = await uploadReceiptToStorage(receiptFileData.file);
          allReceiptUrls.push(uploadResult.publicUrl);
          allReceiptFilenames.push(uploadResult.fileName);
        }
        setUploadingReceipt(false);
      }

      // Update expense with all receipt data
      const { error: updateError } = await supabase
        .from("expenses")
        .update({
          title: formData.title,
          description: formData.description,
          amount: parseFloat(formData.amount),
          currency_code: formData.currency_code,
          category: formData.category,
          expense_date: formData.expense_date,
          payment_method: formData.payment_method,
          vendor: formData.vendor,
          is_reimbursable: formData.is_reimbursable,
          notes: formData.notes,
          receipt_url: allReceiptUrls.length > 0 ? allReceiptUrls[0] : null,
          receipt_urls: allReceiptUrls.length > 0 ? allReceiptUrls : null,
          receipt_filenames: allReceiptFilenames.length > 0 ? allReceiptFilenames : null,
          ai_extracted_data: aiExtractedData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expenseId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      router.push("/dashboard/expenses");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update expense";
      setError(message);
    } finally {
      setLoading(false);
      setUploadingReceipt(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <DashboardNavbar />
        <main className="w-full bg-white">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-card rounded-xl p-8 border shadow-sm flex justify-center">
              <p>Loading expense...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const totalReceipts = existingReceiptUrls.length + receiptFiles.length;

  return (
    <>
      <DashboardNavbar />
      <main className="w-full bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Edit Expense</h1>
            <p className="text-muted-foreground">
              Update receipts or modify expense details
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Receipt Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Receipt Upload ({totalReceipts} file{totalReceipts !== 1 ? 's' : ''})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* File thumbnails */}
                  {totalReceipts > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {existingReceiptUrls.map((url, index) => (
                        <div
                          key={`existing-${index}`}
                          className={`relative w-20 h-20 border-2 rounded cursor-pointer ${
                            index === currentReceiptIndex
                              ? "border-blue-500"
                              : "border-gray-300"
                          }`}
                          onClick={() => selectReceiptFile(index)}
                        >
                          <img
                            src={url}
                            alt={`Existing receipt ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExistingReceipt(index);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {receiptFiles.map((receiptFile, index) => (
                        <div
                          key={receiptFile.id}
                          className={`relative w-20 h-20 border-2 rounded cursor-pointer ${
                            existingReceiptUrls.length + index === currentReceiptIndex
                              ? "border-blue-500"
                              : "border-gray-300"
                          }`}
                          onClick={() => selectReceiptFile(existingReceiptUrls.length + index)}
                        >
                          <img
                            src={receiptFile.preview}
                            alt={`New receipt ${index + 1}`}
                            className="w-full h-full object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeReceiptFile(receiptFile.id);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${
                      !receiptPreview
                        ? "cursor-pointer hover:border-gray-400"
                        : ""
                    }`}
                    onClick={(e) => {
                      // Prevent trigger during selection
                      if (isSelecting || isDrawing) return;

                      if (!receiptPreview) {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    {receiptPreview ? (
                      <div className="relative inline-block w-full max-w-2xl mx-auto">
                        {receiptPreview === "pdf" ? (
                          <div className="w-full text-center text-gray-600 text-sm min-h-[400px] flex items-center justify-center border-2 border-gray-200 rounded-lg shadow-md">
                            📄 PDF uploaded. OCR will process it automatically.
                          </div>
                        ) : (
                          <img
                            src={receiptPreview}
                            alt="Receipt preview"
                            className={`w-full h-auto min-h-[400px] max-h-[600px] object-contain rounded-lg shadow-md border-2 border-gray-200 ${
                              isSelecting
                                ? "cursor-crosshair select-none"
                                : "cursor-pointer"
                            }`}
                            onLoad={(e) => {
                              const t = e.currentTarget;
                              setImgNatural({
                                w: t.naturalWidth,
                                h: t.naturalHeight,
                              });
                            }}
                            onMouseDown={handleImageMouseDown}
                            onMouseMove={handleImageMouseMove}
                            onMouseUp={handleImageMouseUp}
                            onMouseLeave={() => {
                              if (isDrawing) {
                                setIsDrawing(false);
                                setSelectionStart(null);
                                setSelectedArea(null);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Skip accidental click right after selecting
                              if (skipNextClickRef.current) {
                                skipNextClickRef.current = false;
                                return;
                              }
                              if (isSelecting || selectedArea) return;
                              fileInputRef.current?.click();
                            }}
                            draggable={false}
                          />
                        )}

                        {selectedArea && receiptPreview !== "pdf" && (
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-200/30 pointer-events-none"
                            style={{
                              left: `${selectedArea.x}px`,
                              top: `${selectedArea.y}px`,
                              width: `${selectedArea.width}px`,
                              height: `${selectedArea.height}px`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              Selected Area
                            </div>
                          </div>
                        )}

                        {receiptPreview &&
                          receiptPreview !== "pdf" &&
                          !isSelecting &&
                          !aiProcessing && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={startAreaSelection}
                              className="w-full mt-4"
                            >
                              Select Area on Image
                            </Button>
                          )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                        <div>
                          <p className="text-lg font-medium">Upload Receipts</p>
                          <p className="text-sm text-gray-600">
                            Click to select multiple images or PDF files (max 20MB each)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                  />

                  {aiProcessing && (
                    <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        Processing receipt with OCR...
                      </span>
                    </div>
                  )}

                  {aiExtractedData && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          OCR extracted data (auto-filled below)
                        </span>
                      </div>
                      <div className="text-xs text-green-700 space-y-1">
                        <p>Amount: ${aiExtractedData.amount}</p>
                        <p>Vendor: {aiExtractedData.vendor}</p>
                        <p>Date: {aiExtractedData.date}</p>
                        <p>Category: {aiExtractedData.category}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expense Form */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        handleInputChange("title", e.target.value)
                      }
                      placeholder="Enter expense title"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          handleInputChange("amount", e.target.value)
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={formData.currency_code}
                        onValueChange={(value) =>
                          handleInputChange("currency_code", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.id} value={currency.code}>
                              {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        handleInputChange("category", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expense_date">Date *</Label>
                    <Input
                      id="expense_date"
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) =>
                        handleInputChange("expense_date", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="vendor">Vendor</Label>
                    <Input
                      id="vendor"
                      value={formData.vendor}
                      onChange={(e) =>
                        handleInputChange("vendor", e.target.value)
                      }
                      placeholder="Enter vendor name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) =>
                        handleInputChange("payment_method", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Enter expense description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        handleInputChange("notes", e.target.value)
                      }
                      placeholder="Additional notes"
                      rows={2}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={loading || uploadingReceipt}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        uploadingReceipt ||
                        !formData.title ||
                        !formData.amount
                      }
                      className="flex-1"
                    >
                      {loading || uploadingReceipt ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {uploadingReceipt ? "Uploading..." : "Updating..."}
                        </>
                      ) : (
                        "Update Expense"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}