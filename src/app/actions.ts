"use server";

import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../supabase/server";

// Function to check if any users exist and create a default admin if none exis

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const companyName = formData.get("company_name")?.toString() || "";
  const supabase = await createServerSupabaseClient();
  const origin = headers().get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?redirect_to=/dashboard/company-profile?setup=required`,
      data: {
        full_name: fullName,
        email,
        company_name: companyName,
      },
    },
  });

  if (error) {
    console.error("Signup error:", error.code, error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  if (!user) {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Please check your email to confirm your account before signing in.",
    );
  }

  // If user is created but not confirmed, show success message
  if (!user.email_confirmed_at) {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Please check your email and click the confirmation link to activate your account.",
    );
  }

  // If we reach here, the user is confirmed, so create user record and company profile
  try {
    // Insert user record
    const { error: insertError } = await supabase.from("users").insert({
      id: user.id,
      name: fullName,
      full_name: fullName,
      email,
      user_id: user.id,
      token_identifier: user.id,
    });

    if (insertError) {
      console.error("Error inserting user record:", insertError);
    }

    // Create company profile
    const { error: companyError } = await supabase
      .from("company_profile")
      .insert({
        name: companyName || fullName + "'s Company",
        prefix: "INV-",
        default_currency: "HKD",
        user_id: user.id,
        created_at: new Date().toISOString(),
        is_complete: false,
      });

    if (companyError) {
      console.error("Error creating company profile:", companyError);
    }
  } catch (err) {
    console.error("Error during user/company setup:", err);
  }

  // Redirect to company profile setup
  return redirect("/dashboard/company-profile?setup=required");
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // 用 redirect 回登入頁，帶 error query
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createServerSupabaseClient();
  const origin = headers().get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createServerSupabaseClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const duplicateInvoiceAction = async (invoiceId: string) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    // Get the original invoice with items
    const { data: originalInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        invoice_items(*)
      `,
      )
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !originalInvoice) {
      return { error: "Invoice not found" };
    }

    // Return the invoice data for duplication
    return {
      success: true,
      invoiceData: {
        customer_id: originalInvoice.customer_id,
        currency_code: originalInvoice.currency_code,
        notes: originalInvoice.notes || "",
        discount_amount: originalInvoice.discount_amount || 0,
        items: originalInvoice.invoice_items.map((item: any) => ({
          product_id: item.product_id || "",
          product_name: item.product_name || "",
          description: item.description || "",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          tax_rate: item.tax_rate || 0,
        })),
      },
    };
  } catch (error) {
    console.error("Error duplicating invoice:", error);
    return { error: "Failed to duplicate invoice" };
  }
};

export const sendInvoiceEmailAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const invoiceId = formData.get("invoice_id") as string;

  try {
    // Get invoice with customer data
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        customers(*)
      `,
      )
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      throw new Error("Invoice not found");
    }

    // Get company profile with SMTP settings
    const { data: companyProfile, error: profileError } = await supabase
      .from("company_profile")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (profileError || !companyProfile) {
      console.error("Company profile not found:", profileError);
      throw new Error("Company profile not found");
    }

    // Check if SMTP is configured
    if (
      !companyProfile.smtp_host ||
      !companyProfile.smtp_username ||
      !companyProfile.smtp_password
    ) {
      console.error("SMTP not configured properly");
      throw new Error("SMTP not configured properly");
    }

    // Check if customer has email
    if (!invoice.customers?.email) {
      console.error("Customer email not found");
      throw new Error("Customer email not found");
    }

    // Generate PDF attachment by calling the PDF generation function directly
    let pdfBuffer: ArrayBuffer;
    try {
      // Import the PDF generation function from the route file
      const { GET: generatePDF } = await import(
        "./api/invoices/[id]/pdf/route"
      );

      // Create a mock request object (URL doesn't matter since we're calling directly)
      const mockRequest = new NextRequest(
        `http://localhost/api/invoices/${invoiceId}/pdf`,
      );

      // Call the PDF generation function directly
      const pdfResponse = await generatePDF(mockRequest, {
        params: { id: invoiceId },
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error("PDF generation failed:", pdfResponse.status, errorText);
        throw new Error("PDF generation failed");
      }

      pdfBuffer = await pdfResponse.arrayBuffer();
    } catch (pdfError) {
      console.error("Error generating PDF attachment:", pdfError);
      throw new Error("PDF generation failed");
    }

    // Prepare email template
    let emailBody =
      companyProfile.email_template ||
      "Dear {customer_name},\n\nPlease find attached your invoice {invoice_number}.\n\nThank you for your business!\n\nBest regards,\n{company_name}";

    // Replace placeholders
    emailBody = emailBody
      .replace(/{customer_name}/g, invoice.customers.name || "Valued Customer")
      .replace(/{invoice_number}/g, invoice.invoice_number)
      .replace(/{company_name}/g, companyProfile.name || "Your Company")
      .replace(
        /{total_amount}/g,
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: invoice.currency_code || "USD",
        }).format(invoice.total_amount),
      )
      .replace(/{due_date}/g, new Date(invoice.due_date).toLocaleDateString());

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
        throw new Error(`SMTP verification failed: ${verifyError.message}`);
      }

      const senderAddress =
        companyProfile.smtp_sender || companyProfile.smtp_username;
      const mailOptions = {
        from: `"${companyProfile.name}" <${senderAddress}>`,
        to: invoice.customers.email,
        subject: `Invoice ${invoice.invoice_number} from ${companyProfile.name}`,
        text: emailBody,
        html: emailBody.replace(/\n/g, "<br>"),
        attachments: [
          {
            filename: `invoice-${invoice.invoice_number}.pdf`,
            content: Buffer.from(pdfBuffer),
            contentType: "application/pdf",
          },
        ],
      };

      // Send the email
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);

      // Update invoice status to 'sent' if it was 'draft'
      if (invoice.status === "draft") {
        const { error: updateError } = await supabase
          .from("invoices")
          .update({ status: "sent" })
          .eq("id", invoiceId);

        if (updateError) {
          console.error("Error updating invoice status:", updateError);
        }
      }

      return { success: true, message: "Email sent successfully" };
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      throw new Error(`Email sending failed: ${emailError.message}`);
    }
  } catch (error: any) {
    console.error("Unexpected error in sendInvoiceEmailAction:", error);
    throw error;
  }
};

export const createCustomerAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const tax_id = formData.get("tax_id") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const postal_code = formData.get("postal_code") as string;
  const country = formData.get("country") as string;
  const notes = formData.get("notes") as string;

  const { error } = await supabase.from("customers").insert([
    {
      name,
      email,
      phone,
      tax_id,
      address,
      city,
      state,
      postal_code,
      country,
      notes,
      user_id: user.id, // ✅ this line is essential
      created_by: user.id,
    },
  ]);

  redirect("/dashboard/customers");
};

export const deleteCustomerAction = async (customerId: string) => {
  "use server";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("created_by", user.id);

  if (error) throw new Error("Failed to delete customer");
};

export const updateCustomerAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  const { error } = await supabase
    .from("customers")
    .update({ name, email })
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard/customers");
};

export const testSmtpAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const smtp_host = formData.get("smtp_host") as string;
  const smtp_port = formData.get("smtp_port") as string;
  const smtp_username = formData.get("smtp_username") as string;
  const smtp_password = formData.get("smtp_password") as string;
  const smtp_secure = formData.get("smtp_secure") as string;
  const smtp_sender = formData.get("smtp_sender") as string;
  const test_email = formData.get("test_email") as string;

  if (!smtp_host || !smtp_username || !smtp_password || !test_email) {
    throw new Error("Missing required SMTP settings or test email");
  }

  try {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 587,
      secure: smtp_secure === "SSL" || parseInt(smtp_port) === 465,
      auth: {
        user: smtp_username,
        pass: smtp_password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    // Verify SMTP connection
    await transporter.verify();

    // Send test email
    const senderAddress = smtp_sender || smtp_username;
    const mailOptions = {
      from: `"Test Email" <${senderAddress}>`,
      to: test_email,
      subject: "SMTP Test Email",
      text: "This is a test email to verify your SMTP settings are working correctly.",
      html: "<p>This is a test email to verify your SMTP settings are working correctly.</p>",
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Test email sent successfully:", info.messageId);

    return { success: true, message: "Test email sent successfully!" };
  } catch (error: any) {
    console.error("SMTP test failed:", error);
    throw new Error(`SMTP test failed: ${error.message}`);
  }
};

export const updateCompanyProfileAction = async (formData: FormData) => {
  "use server";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const tel = formData.get("tel") as string;
  const address = formData.get("address") as string;
  const contact = formData.get("contact") as string;
  const prefix = formData.get("prefix") as string;
  const default_currency = formData.get("default_currency") as string;
  const payment_terms = formData.get("payment_terms") as string;
  const bank_account = formData.get("bank_account") as string;
  const logo_url = formData.get("logo_url") as string;
  const setup = formData.get("setup") as string;

  // Update company profile
  const { error } = await supabase
    .from("company_profile")
    .update({
      name,
      tel,
      address,
      contact,
      prefix,
      default_currency,
      payment_terms,
      bank_account,
      logo_url: logo_url || undefined,
      is_complete: true, // Mark as complete when user saves profile
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating company profile:", error);
    throw new Error(error.message);
  }

  // If this was part of the initial setup, redirect to dashboard
  if (setup === "required") {
    return redirect("/dashboard");
  }

  // Otherwise stay on the company profile page
  return redirect("/dashboard/company-profile");
};
