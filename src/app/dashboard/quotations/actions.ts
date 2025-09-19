"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

// 🔹 Helper for safe error handling
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createQuotationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const quotationNumber = formData.get("quotation_number") as string;
    const customerId = formData.get("customer_id");
    const issueDate = formData.get("issue_date");
    const validUntil = formData.get("valid_until");
    const currency = formData.get("currency_code");
    const status = formData.get("status");
    const notes = formData.get("notes");
    const termsConditions = formData.get("terms_conditions");
    const discountAmount = Number(formData.get("discount_amount") || 0);
    const subtotal = Number(formData.get("subtotal") || 0);
    const taxAmount = Number(formData.get("tax_amount") || 0);
    const totalAmount = Number(formData.get("total_amount") || 0);

    // First, insert the quotation
    const { data: quotation, error: insertError } = await supabase
      .from("quotations")
      .insert({
        quotation_number: quotationNumber,
        customer_id: customerId,
        issue_date: issueDate,
        valid_until: validUntil,
        currency_code: currency,
        status,
        notes,
        terms_conditions: termsConditions,
        discount_amount: discountAmount,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating quotation:", insertError);
      throw new Error(`Failed to create quotation: ${insertError.message}`);
    }

    // Save quotation items
    const items: any[] = [];
    for (let i = 0; formData.has(`items[${i}][description]`); i++) {
      const quantity = Number(formData.get(`items[${i}][quantity]`));
      const unitPrice = Number(formData.get(`items[${i}][unit_price]`));
      const taxRate = Number(formData.get(`items[${i}][tax_rate]`));
      const lineTotal = quantity * unitPrice;
      const taxAmount = lineTotal * (taxRate / 100);
      const productId = formData.get(`items[${i}][product_id]`) as string;

      items.push({
        quotation_id: quotation.id,
        product_id: productId && productId.trim() !== "" ? productId : null,
        description: formData.get(`items[${i}][description]`),
        quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        line_total: lineTotal,
      });
    }

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("quotation_items")
        .insert(items);

      if (itemError) {
        console.error("Error creating quotation items:", itemError);
        throw new Error(
          `Failed to create quotation items: ${itemError.message}`,
        );
      }
    }

    revalidatePath("/dashboard/quotations");
    redirect(`/dashboard/quotations/${quotation.id}`);
  } catch (error: any) {
    // Handle redirect errors (which are expected)
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in createQuotationAction:", error);
    throw error;
  }
}

export async function convertQuotationToInvoiceAction(quotationId: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get quotation with items
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(
        `
        *,
        quotation_items(*)
      `,
      )
      .eq("id", quotationId)
      .single();

    if (quotationError) {
      throw new Error(`Failed to fetch quotation: ${quotationError.message}`);
    }

    // Get latest invoice number for the current user
    const { data: latestInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get company profile for prefix
    const { data: companyProfile } = await supabase
      .from("company_profile")
      .select("prefix")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    let nextNumber = 1;
    const currentPrefix = companyProfile?.prefix || "INV-";

    if (latestInvoice?.invoice_number) {
      const escapedPrefix = currentPrefix.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const regex = new RegExp(`^${escapedPrefix}(\\d+)`);
      const match = latestInvoice.invoice_number.match(regex);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const invoiceNumber = `${currentPrefix}${String(nextNumber).padStart(4, "0")}`;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: quotation.customer_id,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        currency_code: quotation.currency_code,
        status: "draft",
        notes: quotation.notes,
        discount_amount: quotation.discount_amount,
        subtotal: quotation.subtotal,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        user_id: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    // Create invoice items
    const invoiceItems = quotation.quotation_items.map((item: any) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
      line_total: item.line_total,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      throw new Error(`Failed to create invoice items: ${itemsError.message}`);
    }

    // Update quotation status and link to invoice
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "converted",
        converted_invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quotationId);

    if (updateError) {
      console.error("Error updating quotation:", updateError);
    }

    revalidatePath("/dashboard/quotations");
    revalidatePath("/dashboard/invoices");

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("Error converting quotation to invoice:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function duplicateQuotationAction(quotationId: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get quotation with items
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(
        `
        *,
        quotation_items(*)
      `,
      )
      .eq("id", quotationId)
      .single();

    if (quotationError) {
      throw new Error(`Failed to fetch quotation: ${quotationError.message}`);
    }

    return {
      success: true,
      quotationData: {
        customer_id: quotation.customer_id,
        currency_code: quotation.currency_code,
        notes: quotation.notes,
        terms_conditions: quotation.terms_conditions,
        discount_amount: quotation.discount_amount,
        items: quotation.quotation_items,
      },
    };
  } catch (error) {
    console.error("Error duplicating quotation:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendQuotationEmailAction(
  quotationId: string,
  recipientEmail: string,
) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get quotation with customer data
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(
        `
        *,
        customers(*)
      `,
      )
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .single();

    if (quotationError || !quotation) {
      console.error("Quotation not found:", quotationError);
      return { success: false, error: "Quotation not found" };
    }

    // Get company profile with SMTP settings
    const { data: companyProfiles, error: profileError } = await supabase
      .from("company_profile")
      .select("*, quotation_email_template, email_template")
      .eq("user_id", user.id)
      .limit(1);

    const companyProfile = Array.isArray(companyProfiles) ? companyProfiles[0] : companyProfiles;

    if (profileError || !companyProfile) {
      console.error("Company profile not found:", profileError);
      return { success: false, error: "Company profile not found" };
    }

    // Check if SMTP is configured
    if (
      !companyProfile.smtp_host ||
      !companyProfile.smtp_username ||
      !companyProfile.smtp_password
    ) {
      console.error("SMTP not configured properly");
      return { success: false, error: "SMTP not configured properly" };
    }

    // Use provided email or customer email
    const customerEmail = recipientEmail || quotation.customers?.email;
    if (!customerEmail) {
      console.error("Customer email not found");
      return { success: false, error: "Customer email not found" };
    }

    // Generate PDF attachment by calling the PDF generation function directly
    let pdfBuffer: ArrayBuffer;
    try {
      // Import the PDF generation function from the route file
      const { GET: generatePDF } = await import(
        "../../api/quotations/[id]/pdf/route"
      );

      // Create a mock request object (URL doesn't matter since we're calling directly)
      const mockRequest = new NextRequest(
        `http://localhost/api/quotations/${quotationId}/pdf`,
      );

      // Call the PDF generation function directly
      const pdfResponse = await generatePDF(mockRequest, {
        params: { id: quotationId },
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error("PDF generation failed:", pdfResponse.status, errorText);
        return { success: false, error: "PDF generation failed" };
      }

      pdfBuffer = await pdfResponse.arrayBuffer();
    } catch (pdfError) {
      console.error("Error generating PDF attachment:", pdfError);
      return { success: false, error: "PDF generation failed" };
    }

    // Prepare email template
    console.log("Company profile quotation_email_template:", companyProfile.quotation_email_template);
    console.log("Company profile email_template:", companyProfile.email_template);
    
    let emailBody = companyProfile.quotation_email_template;
    
    // Only fall back to invoice template if quotation template is truly empty
    if (!emailBody || emailBody.trim() === '') {
      console.log("Using fallback email_template");
      emailBody = companyProfile.email_template;
    } else {
      console.log("Using quotation_email_template");
    }
    
    // Final fallback to default quotation template
    if (!emailBody || emailBody.trim() === '') {
      console.log("Using default quotation template");
      emailBody = "Dear {customer_name},\n\nPlease find attached your quotation {quotation_number}.\n\nThank you for your interest!\n\nBest regards,\n{company_name}";
    }

    // Replace placeholders
    emailBody = emailBody
      .replace(/{customer_name}/g, quotation.customers?.name || "Valued Customer")
      .replace(/{quotation_number}/g, quotation.quotation_number)
      .replace(/{company_name}/g, companyProfile.name || "Your Company")
      .replace(
        /{total_amount}/g,
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: quotation.currency_code || "USD",
        }).format(quotation.total_amount),
      )
      .replace(/{valid_until}/g, new Date(quotation.valid_until).toLocaleDateString());

    // Send email using Nodemailer with SMTP settings from company profile
    try {
      const nodemailer = require("nodemailer");

      // Create transporter with SMTP settings from company profile
      const transporter = nodemailer.createTransport({
        host: companyProfile.smtp_host,
        port: companyProfile.smtp_port || 587,
        secure:
          companyProfile.smtp_secure === "SSL" ||
          companyProfile.smtp_port === 465,
        auth: {
          user: companyProfile.smtp_username,
          pass: companyProfile.smtp_password,
        },
        // Add connection timeout and other options
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000, // 5 seconds
        socketTimeout: 10000, // 10 seconds
      });

      // Verify SMTP connection
      try {
        await transporter.verify();
        console.log("SMTP connection verified successfully");
      } catch (verifyError: any) {
        console.error("SMTP verification failed:", verifyError);
        return { success: false, error: `SMTP verification failed: ${verifyError.message}` };
      }

      const senderAddress =
        companyProfile.smtp_sender || companyProfile.smtp_username;
      const mailOptions = {
        from: `"${companyProfile.name}" <${senderAddress}>`,
        to: customerEmail,
        subject: `Quotation ${quotation.quotation_number} from ${companyProfile.name}`,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
        attachments: [
          {
            filename: `quotation-${quotation.quotation_number}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: "application/pdf",
          },
        ],
      };

      // Send the email
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);

      // Update quotation status to 'sent' if it was 'draft'
      if (quotation.status === "draft") {
        const { error: updateError } = await supabase
          .from("quotations")
          .update({ 
            status: "sent",
            updated_at: new Date().toISOString(),
          })
          .eq("id", quotationId);

        if (updateError) {
          console.error("Error updating quotation status:", updateError);
        }
      }

      revalidatePath("/dashboard/quotations");

      return { success: true, message: "Quotation email sent successfully" };
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      return { success: false, error: `Email sending failed: ${emailError.message}` };
    }
  } catch (error: any) {
    console.error("Unexpected error in sendQuotationEmailAction:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}