"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";

interface DownloadButtonWithDateProps {
  action: (from?: Date, to?: Date) => Promise<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  children: React.ReactNode;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

export function DownloadButtonWithDate({
  action,
  children,
  variant = "default",
}: DownloadButtonWithDateProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const result = await action(dateRange?.from, dateRange?.to);

      // Create blob and download
      const blob = new Blob([result.content], { type: result.contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setIsOpen(false);
      setDateRange(undefined);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="bg-white">
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Select Date Range for Report</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose a date range to filter the report data. Leave empty for all-time data.
          </p>
          <DatePickerWithRange
            date={dateRange}
            setDate={setDateRange}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              "Download Report"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}