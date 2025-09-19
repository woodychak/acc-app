import { sendQuotationEmailAction } from "../actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let quotationId: string = "";

  try {
    const formData = await request.formData();
    quotationId = formData.get("quotation_id") as string;

    if (!quotationId) {
      throw new Error("Quotation ID is required");
    }

    // Get customer email from the quotation
    const result = await sendQuotationEmailAction(quotationId, "");

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    // Get the correct site URL from request headers or environment
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const siteUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/auth/v1", "") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    // If successful, redirect to quotation page with success message
    const redirectUrl = new URL(
      `/dashboard/quotations/${quotationId}?success=email_sent`,
      siteUrl,
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("Error in quotation send-email route:", error);

    // Get the correct site URL from request headers or environment
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const siteUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/auth/v1", "") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

    // If we don't have quotationId from the try block, try to get it again
    if (!quotationId) {
      try {
        const formData = await request.formData();
        quotationId = formData.get("quotation_id") as string;
      } catch (formError) {
        console.error("Could not get quotation ID from form data:", formError);
        quotationId = "unknown";
      }
    }

    const errorMessage = encodeURIComponent(
      error.message || "Failed to send email",
    );
    const redirectUrl = new URL(
      `/dashboard/quotations/${quotationId}?error=email_send_failed&message=${errorMessage}`,
      siteUrl,
    );

    return NextResponse.redirect(redirectUrl);
  }
}