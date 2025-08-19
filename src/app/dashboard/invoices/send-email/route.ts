import { sendInvoiceEmailAction } from "../../../actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let invoiceId: string = "";

  try {
    const formData = await request.formData();
    invoiceId = formData.get("invoice_id") as string;

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    const result = await sendInvoiceEmailAction(formData);

    // Get the correct site URL from request headers or environment
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const siteUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/auth/v1", "") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    // If successful, redirect to invoice page with success message
    const redirectUrl = new URL(
      `/dashboard/invoices/${invoiceId}?success=email_sent`,
      siteUrl,
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("Error in send-email route:", error);

    // Get the correct site URL from request headers or environment
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const siteUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/auth/v1", "") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    // If we don't have invoiceId from the try block, try to get it again
    if (!invoiceId) {
      try {
        const formData = await request.formData();
        invoiceId = formData.get("invoice_id") as string;
      } catch (formError) {
        console.error("Could not get invoice ID from form data:", formError);
        invoiceId = "unknown";
      }
    }

    const errorMessage = encodeURIComponent(
      error.message || "Failed to send email",
    );
    const redirectUrl = new URL(
      `/dashboard/invoices/${invoiceId}?error=email_send_failed&message=${errorMessage}`,
      siteUrl,
    );

    return NextResponse.redirect(redirectUrl);
  }
}
