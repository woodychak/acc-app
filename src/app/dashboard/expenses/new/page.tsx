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
  MousePointer,
  X,
} from "lucide-react";
import { useState, useRef, ChangeEvent } from "react";
import { createClient } from "../../../../../supabase/client";
import { useRouter } from "next/navigation";
import { extractReceiptData } from "@/lib/receipt-ocr";
import { useEffect } from "react";

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

type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
};

type ReceiptFileData = {
  file: File;
  preview: string;
  id: string;
};

export default function NewExpensePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<ReceiptFileData[]>([]);
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
  const [currencies, setCurrencies] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      symbol: string;
      is_default: boolean;
    }>
  >([]);
  const [formData, setFormData] = useState({
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
  type FormField = keyof typeof formData;
  const skipNextClickRef = useRef(false);
  // New states for camera
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState("");
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    area: { x: 0, y: 0, width: 0, height: 0 },
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropImageRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);

  // Handle upload
  const handleUploadClick = () => {
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 150); // avoids conflicts after selection
  };
  // Handle camera capture
  const handleCameraClick = () => {
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 150);
  };

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Fetch currencies on component mount
  useEffect(() => {
    const fetchCurrencies = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: currenciesData } = await supabase
        .from("currencies")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("code", { ascending: true });

      setCurrencies(currenciesData || []);

      // Set default currency
      const defaultCurr =
        currenciesData?.find((c) => c.is_default)?.code || "USD";
      setFormData((prev) => ({ ...prev, currency_code: defaultCurr }));
    };

    fetchCurrencies();
  }, []);

  // Start camera when showCamera toggled on
  useEffect(() => {
    async function startCamera() {
      try {
        if (showCamera) {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setStream(mediaStream);
        } else {
          // Stop camera when hiding UI
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
          }
        }
      } catch (err) {
        console.error("Camera error:", err);
        setShowCamera(false);
      }
    }
    startCamera();

    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw current frame onto canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Show crop modal instead of processing immediately
      const imageUrl = URL.createObjectURL(blob);
      setCapturedImage(imageUrl);
      setShowCamera(false);
      setShowCropModal(true);
    }, "image/png");
  };

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

  const handleCropConfirm = async () => {
    if (!capturedImage || !cropImageRef.current) return;

    const img = cropImageRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    // Calculate scale factors
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    // Set canvas size to crop area
    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;

    // Draw cropped image
    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Create file from cropped image
      let file = new File([blob], `receipt_${Date.now()}.png`, {
        type: "image/png",
      });

      // Compress the image
      file = await compressImage(file);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);

      // Add to receipt files
      const newReceiptFile: ReceiptFileData = {
        file,
        preview: previewUrl,
        id: `${Date.now()}`,
      };

      setReceiptFiles([newReceiptFile]);
      setReceiptPreview(previewUrl);
      setCurrentReceiptIndex(0);
      setShowCropModal(false);
      setCapturedImage(null);

      // Run OCR on cropped and compressed image
      setAiProcessing(true);
      try {
        const extractedData = await extractReceiptData(file);
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
      } catch (err) {
        console.error("OCR after crop failed:", err);
        setError("Failed to read the cropped photo. Try again.");
      } finally {
        setAiProcessing(false);
      }
    }, "image/png");
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setCapturedImage(null);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left - cropArea.x,
      y: e.clientY - rect.top - cropArea.y,
    });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cropImageRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragStart.x;
    const newY = e.clientY - rect.top - dragStart.y;

    // Constrain to image bounds
    const maxX = cropImageRef.current.width - cropArea.width;
    const maxY = cropImageRef.current.height - cropArea.height;

    setCropArea((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    }));
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Auto-detect receipt body function
  const detectReceiptBody = (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Find content boundaries by detecting non-white areas
    let minX = canvas.width,
      maxX = 0,
      minY = canvas.height,
      maxY = 0;
    const threshold = 240; // Adjust this value to be more/less sensitive to light backgrounds

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // If pixel is not close to white, consider it content
        if (r < threshold || g < threshold || b < threshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add some padding around detected content
    const padding = Math.min(canvas.width, canvas.height) * 0.05;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    // Ensure minimum size
    const minSize = Math.min(canvas.width, canvas.height) * 0.3;
    if (maxX - minX < minSize || maxY - minY < minSize) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const halfSize = minSize / 2;
      return {
        x: Math.max(0, centerX - halfSize),
        y: Math.max(0, centerY - halfSize),
        width: Math.min(minSize, canvas.width),
        height: Math.min(minSize, canvas.height),
      };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Handle resize mouse events
  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    const rect = e.currentTarget.getBoundingClientRect();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      area: { ...cropArea },
    });
  };

  const handleResizeMouseMove = (e: React.MouseEvent) => {
    if (!isResizing || !cropImageRef.current) return;

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    const imgWidth = cropImageRef.current.width;
    const imgHeight = cropImageRef.current.height;

    let newArea = { ...resizeStart.area };

    switch (resizeHandle) {
      case "nw":
        newArea.x = Math.max(0, resizeStart.area.x + deltaX);
        newArea.y = Math.max(0, resizeStart.area.y + deltaY);
        newArea.width = Math.max(50, resizeStart.area.width - deltaX);
        newArea.height = Math.max(50, resizeStart.area.height - deltaY);
        break;
      case "ne":
        newArea.y = Math.max(0, resizeStart.area.y + deltaY);
        newArea.width = Math.max(
          50,
          Math.min(imgWidth - newArea.x, resizeStart.area.width + deltaX),
        );
        newArea.height = Math.max(50, resizeStart.area.height - deltaY);
        break;
      case "sw":
        newArea.x = Math.max(0, resizeStart.area.x + deltaX);
        newArea.width = Math.max(50, resizeStart.area.width - deltaX);
        newArea.height = Math.max(
          50,
          Math.min(imgHeight - newArea.y, resizeStart.area.height + deltaY),
        );
        break;
      case "se":
        newArea.width = Math.max(
          50,
          Math.min(imgWidth - newArea.x, resizeStart.area.width + deltaX),
        );
        newArea.height = Math.max(
          50,
          Math.min(imgHeight - newArea.y, resizeStart.area.height + deltaY),
        );
        break;
      case "n":
        newArea.y = Math.max(0, resizeStart.area.y + deltaY);
        newArea.height = Math.max(50, resizeStart.area.height - deltaY);
        break;
      case "s":
        newArea.height = Math.max(
          50,
          Math.min(imgHeight - newArea.y, resizeStart.area.height + deltaY),
        );
        break;
      case "w":
        newArea.x = Math.max(0, resizeStart.area.x + deltaX);
        newArea.width = Math.max(50, resizeStart.area.width - deltaX);
        break;
      case "e":
        newArea.width = Math.max(
          50,
          Math.min(imgWidth - newArea.x, resizeStart.area.width + deltaX),
        );
        break;
    }

    // Ensure crop area stays within image bounds
    if (newArea.x + newArea.width > imgWidth) {
      newArea.width = imgWidth - newArea.x;
    }
    if (newArea.y + newArea.height > imgHeight) {
      newArea.height = imgHeight - newArea.y;
    }

    setCropArea(newArea);
  };

  useEffect(() => {
    if (!selectedArea) return;

    (async () => {
      if (!receiptFiles[currentReceiptIndex]) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = receiptFiles[currentReceiptIndex].preview;

      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const scaleX = img.naturalWidth / selectedArea.displayWidth;
        const scaleY = img.naturalHeight / selectedArea.displayHeight;

        canvas.width = selectedArea.width * scaleX;
        canvas.height = selectedArea.height * scaleY;

        ctx.drawImage(
          img,
          selectedArea.x * scaleX,
          selectedArea.y * scaleY,
          selectedArea.width * scaleX,
          selectedArea.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const croppedFile = new File(
            [blob],
            `cropped_${Date.now()}.png`,
            { type: "image/png" },
          );

          setAiProcessing(true);
          try {
            const extractedData = await extractReceiptData(croppedFile);
            setAiExtractedData(extractedData);
            setFormData((prev) => ({
              ...prev,
              amount: extractedData.amount || prev.amount,
              vendor: extractedData.vendor || prev.vendor,
              expense_date: extractedData.date || prev.expense_date,
              category: extractedData.category || prev.category,
            }));
          } catch (error) {
            console.error("OCR processing failed:", error);
            setError("Failed to process selected area. Please try again.");
          } finally {
            setAiProcessing(false);
          }
        }, "image/png");
      };
    })();
  }, [selectedArea, receiptFiles, currentReceiptIndex]);

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
        const { pdfPageToPng } = await import("@/lib/pdf-to-image");
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

    // Process first file with OCR if this is the first upload
    if (receiptFiles.length === 0 && newReceiptFiles.length > 0) {
      setReceiptPreview(newReceiptFiles[0].preview);
      setCurrentReceiptIndex(0);
      
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
      if (receiptPreview === prev.find((f) => f.id === id)?.preview) {
        if (filtered.length > 0) {
          setReceiptPreview(filtered[0].preview);
          setCurrentReceiptIndex(0);
        } else {
          setReceiptPreview(null);
          setCurrentReceiptIndex(0);
        }
      }
      
      return filtered;
    });
  };

  const selectReceiptFile = (index: number) => {
    if (receiptFiles[index]) {
      setReceiptPreview(receiptFiles[index].preview);
      setCurrentReceiptIndex(index);
      setSelectedArea(null);
      setIsSelecting(false);
    }
  };

  const uploadReceiptToStorage = async (file: File) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, file);

    if (error) throw error;

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

      const receiptUrls: string[] = [];
      const receiptFilenames: string[] = [];

      // Upload all receipt files
      if (receiptFiles.length > 0) {
        setUploadingReceipt(true);
        for (const receiptFileData of receiptFiles) {
          const uploadResult = await uploadReceiptToStorage(receiptFileData.file);
          receiptUrls.push(uploadResult.publicUrl);
          receiptFilenames.push(uploadResult.fileName);
        }
        setUploadingReceipt(false);
      }

      // Create expense record with all receipt data
      const expenseData = {
        ...formData,
        user_id: user.id,
        amount: parseFloat(formData.amount),
        receipt_url: receiptUrls.length > 0 ? receiptUrls[0] : null,
        receipt_filename: receiptFilenames.length > 0 ? receiptFilenames[0] : null,
        receipt_urls: receiptUrls.length > 0 ? receiptUrls : null,
        receipt_filenames: receiptFilenames.length > 0 ? receiptFilenames : null,
        ai_extracted_data: aiExtractedData,
      };

      const { error: insertError } = await supabase
        .from("expenses")
        .insert([expenseData]);

      if (insertError) throw insertError;

      router.push("/dashboard/expenses");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create expense";
      setError(message);
    } finally {
      setLoading(false);
      setUploadingReceipt(false);
    }
  };

  return (
    <>
      <DashboardNavbar />
      <main className="w-full bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Add New Expense</h1>
            <p className="text-muted-foreground">
              Upload receipts or manually enter expense details
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Receipt Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Receipt Upload ({receiptFiles.length} file{receiptFiles.length !== 1 ? 's' : ''})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* File thumbnails */}
                  {receiptFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {receiptFiles.map((receiptFile, index) => (
                        <div
                          key={receiptFile.id}
                          className={`relative w-20 h-20 border-2 rounded cursor-pointer ${
                            index === currentReceiptIndex
                              ? "border-blue-500"
                              : "border-gray-300"
                          }`}
                          onClick={() => selectReceiptFile(index)}
                        >
                          <img
                            src={receiptFile.preview}
                            alt={`Receipt ${index + 1}`}
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
                      // 🚫 Prevent trigger during selection
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
                          <>
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

                                // Prevent file selector from triggering during or after selection
                                // 👇 Skip accidental click right after selecting
                                if (skipNextClickRef.current) {
                                  skipNextClickRef.current = false;
                                  return;
                                }
                                if (isSelecting || selectedArea) return;
                                fileInputRef.current?.click();
                              }}
                              draggable={false}
                            />

                            {selectedArea && (
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
                          </>
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

                    {/* ✅ Add this just below the preview */}
                    {receiptPreview && !isSelecting && !aiProcessing && (
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
                  {/* Take Photo Button Outside Upload Box */}
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      onClick={() => setShowCamera(true)}
                    >
                      Take Photo
                    </button>
                  </div>

                  {/* Camera UI modal or inline */}
                  {showCamera && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50 p-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                      />
                      <div className="mt-4 flex gap-4">
                        <button
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                          onClick={handleCapturePhoto}
                        >
                          Capture Photo
                        </button>
                        <button
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                          onClick={() => setShowCamera(false)}
                        >
                          Cancel
                        </button>
                      </div>
                      <canvas ref={canvasRef} style={{ display: "none" }} />
                    </div>
                  )}

                  {/* Crop Modal */}
                  {showCropModal && capturedImage && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
                        <h3 className="text-lg font-semibold mb-4">
                          Crop Receipt
                        </h3>
                        <div
                          className="relative inline-block"
                          onMouseMove={(e) => {
                            if (isResizing) {
                              handleResizeMouseMove(e);
                            } else if (isDragging) {
                              handleCropMouseMove(e);
                            }
                          }}
                          onMouseUp={handleCropMouseUp}
                          onMouseLeave={handleCropMouseUp}
                        >
                          <img
                            ref={cropImageRef}
                            src={capturedImage}
                            alt="Captured receipt"
                            className="max-w-full max-h-[60vh] object-contain"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              const detectedArea = detectReceiptBody(img);
                              setCropArea(detectedArea);
                            }}
                            draggable={false}
                          />
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-200/30 cursor-move select-none"
                            style={{
                              left: `${cropArea.x}px`,
                              top: `${cropArea.y}px`,
                              width: `${cropArea.width}px`,
                              height: `${cropArea.height}px`,
                            }}
                            onMouseDown={handleCropMouseDown}
                          >
                            <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              Drag to move • Resize with handles
                            </div>

                            {/* Resize handles */}
                            <div
                              className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 cursor-nw-resize hover:bg-blue-600"
                              onMouseDown={(e) =>
                                handleResizeMouseDown(e, "nw")
                              }
                            />
                            <div
                              className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-500 cursor-n-resize hover:bg-blue-600"
                              onMouseDown={(e) => handleResizeMouseDown(e, "n")}
                            />
                            <div
                              className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 cursor-ne-resize hover:bg-blue-600"
                              onMouseDown={(e) =>
                                handleResizeMouseDown(e, "ne")
                              }
                            />
                            <div
                              className="absolute top-1/2 transform -translate-y-1/2 -left-1 w-3 h-3 bg-blue-500 cursor-w-resize hover:bg-blue-600"
                              onMouseDown={(e) => handleResizeMouseDown(e, "w")}
                            />
                            <div
                              className="absolute top-1/2 transform -translate-y-1/2 -right-1 w-3 h-3 bg-blue-500 cursor-e-resize hover:bg-blue-600"
                              onMouseDown={(e) => handleResizeMouseDown(e, "e")}
                            />
                            <div
                              className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 cursor-sw-resize hover:bg-blue-600"
                              onMouseDown={(e) =>
                                handleResizeMouseDown(e, "sw")
                              }
                            />
                            <div
                              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-500 cursor-s-resize hover:bg-blue-600"
                              onMouseDown={(e) => handleResizeMouseDown(e, "s")}
                            />
                            <div
                              className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 cursor-se-resize hover:bg-blue-600"
                              onMouseDown={(e) =>
                                handleResizeMouseDown(e, "se")
                              }
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex gap-4 justify-center">
                          <Button
                            onClick={handleCropConfirm}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Confirm Crop
                          </Button>
                          <Button onClick={handleCropCancel} variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hidden file input for upload - NOW WITH MULTIPLE */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                  />

                  {/* Hidden file input for camera */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
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
                          {uploadingReceipt ? "Uploading..." : "Creating..."}
                        </>
                      ) : (
                        "Create Expense"
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