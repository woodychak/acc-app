import { duplicateInvoiceAction } from "../../../actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const invoiceId = formData.get("invoice_id") as string;
    const result = await duplicateInvoiceAction(invoiceId);

    // Return the result as JSON instead of redirecting
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result?.success && result?.invoiceData) {
      return NextResponse.json({
        success: true,
        invoiceData: result.invoiceData,
      });
    }

    return NextResponse.json(
      { error: "Unknown error occurred" },
      { status: 500 },
    );
  } catch (error: any) {
    console.error("Error in duplicate route:", error);
    return NextResponse.json(
      { error: "Failed to duplicate invoice" },
      { status: 500 },
    );
  }
}
