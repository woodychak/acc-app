import { NextRequest } from "next/server";
import { createClient } from "../../../../../supabase/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        customers(*),
        invoice_items(*)
      `,
      )
      .eq("id", params.id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response("Invoice not found", { status: 404 });
    }

    const { data: companyProfile, error: profileError } = await supabase
      .from("company_profile")
      .select("*")
      .limit(1)
      .single();

    if (profileError) {
      console.error("Error fetching company profile:", profileError);
      return new Response("Failed to fetch company profile", { status: 500 });
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    // Load logo image (from company profile or generate default)
    let logoImage;
    let logoWidth = 0;
    let logoHeight = 0;

    try {
      let logoUrl = companyProfile?.logo_url
        ? companyProfile.logo_url
        : `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(companyProfile?.name || "Company")}&backgroundColor=random`;

      const logoResponse = await fetch(logoUrl);

      if (logoResponse.ok) {
        const logoImageBytes = await logoResponse.arrayBuffer();

        try {
          // Try embedding as PNG first
          logoImage = await pdfDoc.embedPng(new Uint8Array(logoImageBytes));
        } catch (pngError) {
          console.error("Error embedding logo as PNG:", pngError);
          try {
            // If PNG fails, try embedding as JPG
            logoImage = await pdfDoc.embedJpg(new Uint8Array(logoImageBytes));
          } catch (jpgError) {
            console.error("Error embedding logo as JPG:", jpgError);
            // If both fail, logoImage remains undefined
          }
        }

        if (logoImage) {
          const logoDims = logoImage.scale(1);
          logoWidth = logoDims.width;
          logoHeight = logoDims.height;
        }
      } else {
        console.error("Failed to fetch logo URL:", logoUrl);
      }
    } catch (error) {
      console.error("Error loading logo:", error);
      // Continue without logo if there's an error
    }
    // Shift the text below the logo

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    const lineHeight = 16;

    if (logoImage) {
      // Limit logo dimensions to fit nicely in the top-left
      const maxLogoWidth = 120;
      const maxLogoHeight = 60;
      const scale = Math.min(
        maxLogoWidth / logoWidth,
        maxLogoHeight / logoHeight,
        1,
      );

      logoWidth *= scale;
      logoHeight *= scale;

      page.drawImage(logoImage, {
        x: margin,
        y: height - margin - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    }

    // COMPANY PROFILE (Top-left)
    const leftX = margin;
    const rightX = width - margin - 200;
    let y = height - margin - (logoHeight > 0 ? logoHeight + 10 : 0);

    page.drawText(companyProfile.name || "Company Name", {
      x: leftX,
      y,
      size: 14,
      font: boldFont,
    });
    y -= lineHeight;

    if (companyProfile.address) {
      page.drawText(companyProfile.address, {
        x: leftX,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    if (companyProfile.tel) {
      page.drawText(`Tel: ${companyProfile.tel}`, {
        x: leftX,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    // INVOICE DETAILS (Top-right)
    let rightY = height - margin - 16;

    page.drawText(`INVOICE #${invoice.invoice_number}`, {
      x: rightX,
      y: rightY,
      size: 12,
      font: boldFont,
    });
    rightY -= lineHeight;

    page.drawText(
      `Date: ${new Date(invoice.issue_date).toLocaleDateString()}`,
      {
        x: rightX,
        y: rightY,
        size: 10,
        font,
      },
    );
    rightY -= lineHeight;

    page.drawText(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, {
      x: rightX,
      y: rightY,
      size: 10,
      font,
    });

    // ======= BILL TO SECTION (Top-right, under Invoice details) =======
    rightY -= lineHeight * 2; // Add spacing below invoice details

    page.drawText("Bill To:", {
      x: rightX,
      y: rightY,
      size: 12,
      font: boldFont,
    });
    rightY -= lineHeight;

    if (invoice.customers) {
      page.drawText(invoice.customers.name, {
        x: rightX,
        y: rightY,
        size: 12,
        font: boldFont,
      });
      rightY -= lineHeight;

      if (invoice.customers.address) {
        page.drawText(invoice.customers.address, {
          x: rightX,
          y: rightY,
          size: 10,
          font,
        });
        rightY -= lineHeight;
      }

      if (invoice.customers.email) {
        page.drawText(invoice.customers.email, {
          x: rightX,
          y: rightY,
          size: 10,
          font,
        });
        rightY -= lineHeight;
      }
    }

    // ITEMS TABLE HEADER
    y -= lineHeight * 2;

    const col1 = margin;
    const col2 = col1 + 230;
    const col3 = col2 + 50;
    const col4 = col3 + 60;
    const col5 = col4 + 60;

    page.drawText("Description", { x: col1, y, size: 10, font: boldFont });
    page.drawText("Qty", { x: col2, y, size: 10, font: boldFont });
    page.drawText("Unit", { x: col3, y, size: 10, font: boldFont });
    page.drawText("Tax", { x: col4, y, size: 10, font: boldFont });
    page.drawText("Amount", { x: col5, y, size: 10, font: boldFont });

    y -= 5;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;

    // ITEM ROWS
    for (const item of invoice.invoice_items) {
      if (y < margin + 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        const { width: newWidth, height: newHeight } = page.getSize();
        let width = page.getSize().width;
        let height = page.getSize().height;
        y = height - margin;
      }

      page.drawText(item.description, { x: col1, y, size: 10, font });
      page.drawText(item.quantity.toString(), { x: col2, y, size: 10, font });
      page.drawText(item.unit_price.toFixed(2), { x: col3, y, size: 10, font });
      page.drawText(item.tax_rate ? `${item.tax_rate}%` : "0%", {
        x: col4,
        y,
        size: 10,
        font,
      });
      page.drawText(item.line_total.toFixed(2), {
        x: col5,
        y,
        size: 10,
        font,
      });

      y -= lineHeight;
    }

    // TOTALS
    y -= lineHeight;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;

    page.drawText("Subtotal:", {
      x: col4 - 50,
      y,
      size: 10,
      font: boldFont,
    });
    page.drawText(invoice.subtotal.toFixed(2), {
      x: col5,
      y,
      size: 10,
      font,
    });
    y -= lineHeight;

    if (invoice.tax_amount > 0) {
      page.drawText("Tax:", { x: col4 - 50, y, size: 10, font: boldFont });
      page.drawText(invoice.tax_amount.toFixed(2), {
        x: col5,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    if (invoice.discount_amount > 0) {
      page.drawText("Discount:", {
        x: col4 - 50,
        y,
        size: 10,
        font: boldFont,
      });
      page.drawText(`-${invoice.discount_amount.toFixed(2)}`, {
        x: col5,
        y,
        size: 10,
        font,
      });
      y -= lineHeight;
    }

    page.drawText("Total:", {
      x: col4 - 50,
      y,
      size: 12,
      font: boldFont,
    });
    page.drawText(
      `${invoice.currency_code || "HKD"} ${invoice.total_amount.toFixed(2)}`,
      {
        x: col5,
        y,
        size: 12,
        font: boldFont,
      },
    );

    y -= lineHeight * 2;

    // PAYMENT TERMS
    if (companyProfile.payment_terms) {
      page.drawText("Payment Terms:", {
        x: margin,
        y,
        size: 10,
        font: boldFont,
      });
      y -= lineHeight;

      page.drawText(companyProfile.payment_terms, {
        x: margin,
        y,
        size: 10,
        font,
      });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response("Error generating PDF", { status: 500 });
  }
}
