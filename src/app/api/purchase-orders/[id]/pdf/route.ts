import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, cmyk } from "pdf-lib";
import { CompanyProfile } from "../../../../types";

// Helper function to fetch data with retries
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500 && i === retries - 1) {
        return response;
      }
    } catch (error) {
      if (i === retries - 1) throw error;
    }
    await new Promise(res => setTimeout(res, delay * (i + 1)));
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

// PDF Styling Constants (same as quotation)
const Colors = {
  primary: rgb(59 / 255, 130 / 255, 246 / 255),
  primaryDark: rgb(37 / 255, 99 / 255, 235 / 255),
  neutralDarker: rgb(31 / 255, 41 / 255, 55 / 255),
  neutralDark: rgb(75 / 255, 85 / 255, 99 / 255),
  neutralMedium: rgb(209 / 255, 213 / 255, 219 / 255),
  neutralLight: rgb(243 / 255, 244 / 255, 246 / 255),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  transparent: cmyk(0, 0, 0, 0),
};

const FontSizes = {
  title: 28,
  header: 22,
  subHeader: 16,
  body: 10,
  small: 8,
  tableHeader: 10,
};

const PageMargin = 50;
const LineHeight = 15;
const SectionSpacing = 10;
const MinHeaderHeightPoints = 150;

const sanitizePdfText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[^\x00-\xFF]/g, '?');
};

const formatDatePdf = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrencyPdf = (amount: number, currencyCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
};

interface DrawTextOptions {
  font?: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb> | ReturnType<typeof cmyk>;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

function drawTextLine(
  page: PDFPage,
  text: string,
  currentY: number,
  x: number,
  options: DrawTextOptions = {},
): number {
  const {
    font,
    size = FontSizes.body,
    color = Colors.neutralDarker,
    lineHeight: optionLineHeight,
    align = 'left',
    maxWidth,
  } = options;

  const resolvedLineHeight = optionLineHeight ?? LineHeight;
  const sanitizedText = sanitizePdfText(text);

  let drawX = x;
  if (font && maxWidth != null) {
    if (align === 'right') {
      const textWidth = font.widthOfTextAtSize(sanitizedText, size);
      drawX = x + maxWidth - textWidth;
    } else if (align === 'center') {
      const textWidth = font.widthOfTextAtSize(sanitizedText, size);
      drawX = x + (maxWidth - textWidth) / 2;
    }
  }
  if (color !== Colors.transparent) {
    page.drawText(sanitizedText, {
      x: drawX,
      y: currentY,
      font,
      size,
      color: color as ReturnType<typeof rgb>,
    });
  }
  return currentY - resolvedLineHeight;
}

function drawMultiLineText(
  page: PDFPage,
  text: string,
  startY: number,
  x: number,
  options: DrawTextOptions = {},
  pageWidth: number
): number {
  const sanitizedText = sanitizePdfText(text);
  const lines = sanitizedText.split('\n');
  let y = startY;

  const font = options.font;
  const size = options.size ?? FontSizes.body;
  const lineHeight = options.lineHeight ?? size * 1.2;
  const maxWidth = options.maxWidth ?? (pageWidth - x - PageMargin);

  for (const rawLine of lines) {
    let remainingText = rawLine;
    while (remainingText.length > 0) {
      if (!font || font.widthOfTextAtSize(remainingText, size) <= maxWidth) {
        y = drawTextLine(page, remainingText, y, x, { ...options, maxWidth });
        y -= lineHeight;
        break;
      }

      let breakPoint = remainingText.length;
      while (
        breakPoint > 0 &&
        font.widthOfTextAtSize(remainingText.substring(0, breakPoint), size) > maxWidth
      ) {
        breakPoint--;
      }

      const lastSpace = remainingText.lastIndexOf(' ', breakPoint);
      if (lastSpace > 0) breakPoint = lastSpace;

      const lineToDraw = remainingText.substring(0, breakPoint);
      y = drawTextLine(page, lineToDraw, y, x, { ...options, maxWidth });
      y -= lineHeight;
      remainingText = remainingText.substring(breakPoint).trimStart();
    }
  }
  return y + lineHeight;
}

async function drawTableHeaders(page: PDFPage, y: number, fonts: { regular: PDFFont, bold: PDFFont }, pageWidth: number, currency_code: string): Promise<number> {
  let currentY = y;
  const colWidths = [0.40, 0.15, 0.15, 0.15, 0.15];
  const tableWidth = pageWidth - 2 * PageMargin;

  const descColX = PageMargin;
  const qtyColX = PageMargin + tableWidth * colWidths[0];
  const qtyColWidth = tableWidth * colWidths[1] - 5;
  const unitPriceColX = qtyColX + tableWidth * colWidths[1];
  const unitPriceColWidth = tableWidth * colWidths[2] - 5;
  const taxRateColX = unitPriceColX + tableWidth * colWidths[2];
  const taxRateColWidth = tableWidth * colWidths[3] - 5;
  const lineTotalColX = taxRateColX + tableWidth * colWidths[3];
  const lineTotalColWidth = tableWidth * colWidths[4] - 5;

  const headerBaseOptions = { font: fonts.bold, size: FontSizes.tableHeader, color: Colors.neutralDarker };

  page.drawText(sanitizePdfText("Description"), { x: descColX, y: currentY, ...headerBaseOptions });

  let text = sanitizePdfText("Quantity");
  let textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: qtyColX + qtyColWidth - textWidth, y: currentY, ...headerBaseOptions });

  text = sanitizePdfText("Unit Cost");
  textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: unitPriceColX + unitPriceColWidth - textWidth, y: currentY, ...headerBaseOptions });

  text = sanitizePdfText("Tax Rate");
  textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: taxRateColX + taxRateColWidth - textWidth, y: currentY, ...headerBaseOptions });

  text = sanitizePdfText(`Total (${currency_code})`);
  textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: lineTotalColX + lineTotalColWidth - textWidth, y: currentY, ...headerBaseOptions });

  currentY -= LineHeight * 0.5;
  page.drawLine({
    start: { x: PageMargin, y: currentY },
    end: { x: pageWidth - PageMargin, y: currentY },
    thickness: 1,
    color: Colors.neutralDarker,
  });
  currentY -= LineHeight;
  return currentY;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { data: poData, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        vendor:vendors(*),
        customer:customers(*),
        quotation:quotations(quotation_number),
        purchase_order_items(*, product:products(name))
      `)
      .eq("id", params.id)
      .single();

    if (poError || !poData) {
      return new Response(`Purchase order not found: ${poError?.message || 'Unknown error'}`, { status: 404 });
    }

    if (!poData.vendor) {
      return new Response("PO data is incomplete: missing vendor", { status: 500 });
    }

    const { data: companyProfileData, error: profileError } = await supabase
      .from("company_profile")
      .select("*")
      .limit(1)
      .single<CompanyProfile>();

    if (profileError || !companyProfileData) {
      return new Response(`Failed to fetch company profile: ${profileError?.message || 'Unknown error'}`, { status: 500 });
    }

    const companyProfile = companyProfileData;
    const po = poData;
    const vendor = po.vendor;
    const items = po.purchase_order_items || [];
    const currency_code = po.currency_code || "HKD";

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    let { width: pageWidth, height: pageHeight } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fonts = { regular: font, bold: boldFont };

    let currentY = pageHeight - PageMargin;
    const initialHeaderY = currentY;

    // ======== 1. HEADER SECTION ========
    const headerRightX = pageWidth / 2 + 20;
    const headerRightWidth = pageWidth - headerRightX - PageMargin;

    let logoImage;
    let logoHeight = 0;
    const maxLogoHeight = 50;
    const maxLogoWidth = 120;

    try {
      const logoUrl = companyProfile.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sanitizePdfText(companyProfile.name) || "C")}&backgroundColor=3B82F6&textColor=ffffff&fontSize=40&radius=10&format=png`;
      const logoResponse = await fetchWithRetry(logoUrl);
      if (logoResponse.ok) {
        const logoImageBytes = await logoResponse.arrayBuffer();
        const logoUint8Array = new Uint8Array(logoImageBytes);

        const isPng = logoUint8Array.length >= 8 &&
          logoUint8Array[0] === 0x89 && logoUint8Array[1] === 0x50 &&
          logoUint8Array[2] === 0x4E && logoUint8Array[3] === 0x47;

        const isJpeg = logoUint8Array.length >= 2 &&
          logoUint8Array[0] === 0xFF && logoUint8Array[1] === 0xD8;

        try {
          if (isPng) {
            logoImage = await pdfDoc.embedPng(logoUint8Array);
          } else if (isJpeg) {
            logoImage = await pdfDoc.embedJpg(logoUint8Array);
          }
        } catch (e) {
          console.warn("Could not embed logo:", e);
        }

        if (logoImage) {
          const dims = logoImage.scaleToFit(maxLogoWidth, maxLogoHeight);
          logoHeight = dims.height;
          page.drawImage(logoImage, {
            x: PageMargin,
            y: currentY - logoHeight + 20,
            width: dims.width,
            height: dims.height,
          });
        }
      }
    } catch (error) {
      console.error("Error loading logo:", error);
    }

    let leftY = initialHeaderY - (logoImage ? logoHeight + 20 : 0);
    if (!logoImage) leftY = initialHeaderY;

    leftY = drawTextLine(page, companyProfile.name, leftY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (companyProfile.address) leftY = drawMultiLineText(page, companyProfile.address, leftY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark, lineHeight: FontSizes.body * 0.5 }, pageWidth);
    if (companyProfile.tel) leftY = drawTextLine(page, `Tel: ${sanitizePdfText(companyProfile.tel)}`, leftY - 5, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
    if (companyProfile.contact) leftY = drawTextLine(page, `Email: ${sanitizePdfText(companyProfile.contact)}`, leftY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });

    let rightY = initialHeaderY;
    rightY = drawTextLine(page, "PURCHASE ORDER", rightY, headerRightX, { font: boldFont, size: FontSizes.title, color: Colors.primary, align: 'right', maxWidth: headerRightWidth });
    rightY = drawTextLine(page, `# ${sanitizePdfText(po.po_number)}`, rightY, headerRightX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, align: 'right', maxWidth: headerRightWidth });

    rightY -= LineHeight * 0.5;

    rightY = drawTextLine(page, `Date Issued: ${formatDatePdf(po.issue_date)}`, rightY, headerRightX, { font, size: FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth });
    if (po.expected_date) {
      rightY = drawTextLine(page, `Expected: ${formatDatePdf(po.expected_date)}`, rightY, headerRightX, { font, size: FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth });
    }

    const headerContentBottomY = Math.min(leftY, rightY);
    const separatorYFromContent = headerContentBottomY - (SectionSpacing * 0.5);
    const separatorYFromMinHeight = initialHeaderY - MinHeaderHeightPoints;
    currentY = Math.min(separatorYFromContent, separatorYFromMinHeight);

    page.drawLine({
      start: { x: PageMargin, y: currentY },
      end: { x: pageWidth - PageMargin, y: currentY },
      thickness: 1,
      color: Colors.neutralMedium,
    });
    currentY -= SectionSpacing;

    // ======== 2. VENDOR SECTION ========
    currentY = drawTextLine(page, "Vendor:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, vendor.name, currentY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (vendor.address) currentY = drawMultiLineText(page, vendor.address, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
    if (vendor.email) currentY = drawTextLine(page, vendor.email, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
    if (vendor.phone) currentY = drawTextLine(page, vendor.phone, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });

    currentY -= SectionSpacing;

    // ======== 3. ITEMS TABLE ========
    currentY = await drawTableHeaders(page, currentY, fonts, pageWidth, currency_code);

    const tableBottomMargin = PageMargin + 200;

    for (const item of items) {
      if (currentY < tableBottomMargin) {
        page = pdfDoc.addPage([595.28, 841.89]);
        pageHeight = page.getSize().height;
        pageWidth = page.getSize().width;
        currentY = pageHeight - PageMargin;
        currentY = await drawTableHeaders(page, currentY, fonts, pageWidth, currency_code);
      }

      const lineTotalWithTax = item.quantity * item.unit_price;
      const itemLineHeight = LineHeight * 1.2;

      const colWidths = [0.4, 0.15, 0.15, 0.15, 0.15];
      const tableWidth = pageWidth - 2 * PageMargin;
      const descriptionX = PageMargin;
      const descriptionMaxWidth = tableWidth * colWidths[0] - 5;
      const quantityX = PageMargin + tableWidth * colWidths[0];
      const quantityMaxWidth = tableWidth * colWidths[1] - 5;
      const unitPriceX = quantityX + tableWidth * colWidths[1];
      const unitPriceMaxWidth = tableWidth * colWidths[2] - 5;
      const taxRateX = unitPriceX + tableWidth * colWidths[2];
      const taxRateMaxWidth = tableWidth * colWidths[3] - 5;
      const lineTotalX = taxRateX + tableWidth * colWidths[3];
      const lineTotalMaxWidth = tableWidth * colWidths[4] - 5;

      const tempY = currentY;
      const optionsForThisRow: DrawTextOptions = {
        font,
        size: FontSizes.body,
        color: Colors.neutralDarker,
        lineHeight: itemLineHeight,
      };

      // Product name
      const productName = item.product?.name || 'Unnamed Product';
      page.drawText(sanitizePdfText(productName), {
        x: descriptionX,
        y: tempY,
        size: FontSizes.body - 1,
        font: boldFont,
      });

      // Description
      const descStartY = tempY - (FontSizes.body - 1) * 1.2;
      const finalDescY = drawMultiLineText(
        page,
        item.description || '',
        descStartY,
        descriptionX,
        {
          font,
          size: FontSizes.small,
          lineHeight: FontSizes.small * 0.55,
          maxWidth: descriptionMaxWidth,
          color: Colors.neutralDarker,
        },
        pageWidth
      );

      // Right side values
      drawTextLine(page, item.quantity.toString(), tempY, quantityX, {
        ...optionsForThisRow, align: 'right', maxWidth: quantityMaxWidth,
      });

      drawTextLine(page, formatCurrencyPdf(item.unit_price, currency_code), tempY, unitPriceX, {
        ...optionsForThisRow, align: 'right', maxWidth: unitPriceMaxWidth,
      });

      drawTextLine(page, item.tax_rate ? `${item.tax_rate}%` : '0%', tempY, taxRateX, {
        ...optionsForThisRow, align: 'right', maxWidth: taxRateMaxWidth,
      });

      drawTextLine(page, formatCurrencyPdf(lineTotalWithTax, currency_code), tempY, lineTotalX, {
        ...optionsForThisRow, font: boldFont, align: 'right', maxWidth: lineTotalMaxWidth,
      });

      const lineY = finalDescY - 5;
      page.drawLine({
        start: { x: PageMargin, y: lineY },
        end: { x: pageWidth - PageMargin, y: lineY },
        thickness: 0.5,
        color: Colors.neutralLight,
      });

      currentY = lineY - 10;
    }

    currentY -= SectionSpacing * 0.5;

    // ======== 4. TOTALS ========
    const totalsX = pageWidth / 2;
    const totalsLabelWidth = (pageWidth - PageMargin - totalsX) * 0.6;
    const totalsValueX = totalsX + totalsLabelWidth;
    const totalsValueWidth = (pageWidth - PageMargin - totalsX) * 0.4;

    currentY = drawTextLine(page, `Subtotal:`, currentY, totalsX, { font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
    drawTextLine(page, formatCurrencyPdf(po.subtotal, currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });

    if (po.tax_amount > 0) {
      currentY = drawTextLine(page, `Tax:`, currentY, totalsX, { font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, formatCurrencyPdf(po.tax_amount, currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
    }
    if (po.discount_amount > 0) {
      currentY = drawTextLine(page, `Discount:`, currentY, totalsX, { font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, `-${formatCurrencyPdf(po.discount_amount, currency_code)}`, currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
    }

    currentY -= LineHeight * 0.5;
    page.drawLine({
      start: { x: totalsX, y: currentY },
      end: { x: pageWidth - PageMargin, y: currentY },
      thickness: 1,
      color: Colors.neutralDarker,
    });
    currentY -= LineHeight * 1.2;

    currentY = drawTextLine(page, `Total Amount:`, currentY, totalsX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, maxWidth: totalsLabelWidth });
    drawTextLine(page, formatCurrencyPdf(po.total_amount, currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.subHeader, color: Colors.primaryDark, align: 'right', maxWidth: totalsValueWidth });

    currentY -= SectionSpacing;

    // ======== CLIENT / DELIVERY INFO (if present) ========
    if (poData.customer || poData.delivery_address) {
      currentY = drawTextLine(page, "Client & Delivery Information:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDark });
      
      if (poData.customer) {
        currentY = drawTextLine(page, `Client: ${poData.customer.name}`, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDarker });
        if (poData.customer.email) {
          currentY = drawTextLine(page, `Email: ${poData.customer.email}`, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
        }
        if (poData.customer.address) {
          currentY = drawTextLine(page, "Client Address:", currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
          currentY = drawMultiLineText(page, poData.customer.address, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
        }
      }
      
      // Show delivery address (fallback to customer address if not specified)
      const deliveryAddr = poData.delivery_address || poData.customer?.address;
      if (deliveryAddr) {
        currentY = drawTextLine(page, "Delivery Address:", currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
        currentY = drawMultiLineText(page, deliveryAddr, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
      }

      if (poData.quotation?.quotation_number) {
        currentY = drawTextLine(page, `Reference: ${poData.quotation.quotation_number}`, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark });
      }

      currentY -= SectionSpacing;
    }

    // ======== 5. FOOTER ========
    const footerMinY = PageMargin + LineHeight * 8;
    if (currentY < footerMinY && pdfDoc.getPageCount() === 1) {
      currentY = footerMinY;
    } else if (currentY < PageMargin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      pageHeight = page.getSize().height;
      pageWidth = page.getSize().width;
      currentY = pageHeight - PageMargin;
    }

    page.drawLine({
      start: { x: PageMargin, y: currentY },
      end: { x: pageWidth - PageMargin, y: currentY },
      thickness: 1,
      color: Colors.neutralMedium,
    });
    currentY -= SectionSpacing * 0.8;

    if (po.notes) {
      currentY = drawTextLine(page, "Notes:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, po.notes, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
      currentY -= LineHeight * 0.5;
    }

    if (po.terms_conditions) {
      currentY = drawTextLine(page, "Terms & Conditions:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, po.terms_conditions, currentY, PageMargin, { font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
      currentY -= LineHeight * 0.5;
    }



    const finalMessage = sanitizePdfText(`If you have any questions concerning this purchase order, please contact ${sanitizePdfText(companyProfile.contact) || sanitizePdfText(companyProfile.name)}.`);
    const finalMessageYPosition = Math.min(currentY, PageMargin + LineHeight * 2);
    if (finalMessageYPosition < PageMargin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      drawTextLine(page, finalMessage, PageMargin + LineHeight, PageMargin, { font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin });
    } else {
      drawTextLine(page, finalMessage, finalMessageYPosition, PageMargin, { font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="po-${sanitizePdfText(po.po_number)}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating PO PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating PDF: ${errorMessage}`, { status: 500 });
  }
}
