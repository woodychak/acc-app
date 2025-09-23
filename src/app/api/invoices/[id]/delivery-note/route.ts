import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, cmyk } from "pdf-lib";
import { Invoice, Customer, InvoiceItems, CompanyProfile } from "../../../../types";

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

// PDF Styling Constants
const Colors = {
  primary: rgb(59 / 255, 130 / 255, 246 / 255),
  primaryDark: rgb(37 / 255, 99 / 255, 235 / 255),
  neutralDarker: rgb(31 / 255, 41 / 255, 55 / 255),
  neutralDark: rgb(75 / 255, 85 / 255, 99 / 255),
  neutralMedium: rgb(209 / 255, 213 / 255, 219 / 255),
  neutralLight: rgb(243 / 255, 244 / 255, 246 / 255),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  transparent: cmyk(0,0,0,0),
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

// Helper to sanitize text for PDF
const sanitizePdfText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[^\x00-\xFF]/g, '?');
};

// Helper to format date
const formatDatePdf = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Helper to draw text and update Y
interface DrawTextOptions {
  font?: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb> | ReturnType<typeof cmyk>;
  lineHeight?: number;
  xOffset?: number; 
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

// Function to draw multiple lines of text
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
        y = drawTextLine(page, remainingText, y, x, {
          ...options,
          maxWidth,
        });
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
      y = drawTextLine(page, lineToDraw, y, x, {
        ...options,
        maxWidth,
      });
      y -= lineHeight;

      remainingText = remainingText.substring(breakPoint).trimStart();
    }
  }

  return y + lineHeight;
}

// Draw delivery note table headers (without price columns)
async function drawDeliveryNoteTableHeaders(page: PDFPage, y: number, fonts: { regular: PDFFont, bold: PDFFont }, pageWidth: number): Promise<number> {
  let currentY = y;
  const colWidths = [0.70, 0.30]; // Description and Quantity only
  const tableWidth = pageWidth - 2 * PageMargin;
  
  const descColX = PageMargin;
  const qtyColX = PageMargin + tableWidth * colWidths[0];
  const qtyColWidth = tableWidth * colWidths[1] - 5;

  const headerBaseOptions = { font: fonts.bold, size: FontSizes.tableHeader, color: Colors.neutralDarker };

  page.drawText(sanitizePdfText("Description"), { x: descColX, y: currentY, ...headerBaseOptions });
  
  let text = sanitizePdfText("Quantity");
  let textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: qtyColX + qtyColWidth - textWidth, y: currentY, ...headerBaseOptions });
  
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
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        customer:customers(*), 
        invoice_items(*, product:products(name))
      `,
      )
      .eq("id", params.id)
      .single(); 

    if (invoiceError || !invoiceData) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(`Invoice not found: ${invoiceError?.message || 'Unknown error'}`, { status: 404 });
    }
     if (!invoiceData.customer) {
        console.error("Invoice is missing customer data:", invoiceData);
        return new Response("Invoice data is incomplete: missing customer", { status: 500 });
    }
    const invoice: Invoice = invoiceData as Invoice;

    const { data: companyProfileData, error: profileError } = await supabase
      .from("company_profile")
      .select("*")
      .limit(1)
      .single<CompanyProfile>();

    if (profileError || !companyProfileData) {
      console.error("Error fetching company profile:", profileError);
      return new Response(`Failed to fetch company profile: ${profileError?.message || 'Unknown error'}`, { status: 500 });
    }
    const companyProfile: CompanyProfile = companyProfileData as CompanyProfile;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
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
          } else {
            console.warn("Logo format not supported (not PNG or JPEG)");
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
      } else {
         console.warn("Failed to fetch logo:", logoResponse.status, logoUrl);
      }
    } catch (error) {
      console.error("Error loading or embedding logo:", error);
    }
    
    let leftY = initialHeaderY - (logoImage ? logoHeight + 20 : 0); 
    if (!logoImage) {
        leftY = initialHeaderY; 
    }

    leftY = drawTextLine(page, companyProfile.name, leftY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (companyProfile.address) leftY = drawMultiLineText(page, companyProfile.address, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, lineHeight: FontSizes.body * 0.5 }, pageWidth);
    if (companyProfile.tel) leftY = drawTextLine(page, `Tel: ${sanitizePdfText(companyProfile.tel)}`, leftY - 5, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (companyProfile.contact) leftY = drawTextLine(page, `Email: ${sanitizePdfText(companyProfile.contact)}`, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });

    let rightY = initialHeaderY; 
    rightY = drawTextLine(page, "DELIVERY NOTE", rightY, headerRightX, { font: boldFont, size: FontSizes.title, color: Colors.primary, align: 'right', maxWidth: headerRightWidth });
    rightY = drawTextLine(page, `# ${sanitizePdfText(invoice.invoice_number)}-DN`, rightY, headerRightX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, align: 'right', maxWidth: headerRightWidth });
    
    rightY -= LineHeight * 0.5; 
    
    rightY = drawTextLine(page, `Date: ${formatDatePdf(invoice.issue_date)}`, rightY, headerRightX, {font: font, size:FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth});

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

    // ======== 2. DELIVER TO SECTION ========
    currentY = drawTextLine(page, "Deliver To:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, invoice.customer.name, currentY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (invoice.customer.address) currentY = drawMultiLineText(page, invoice.customer.address, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
    if (invoice.customer.email) currentY = drawTextLine(page, invoice.customer.email, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (invoice.customer.phone) currentY = drawTextLine(page, invoice.customer.phone, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    
    currentY -= SectionSpacing;

    // ======== 3. ITEMS TABLE (WITHOUT PRICES) ========
    currentY = await drawDeliveryNoteTableHeaders(page, currentY, fonts, pageWidth);

    const tableBottomMargin = PageMargin + 200;

    for (const item of invoice.invoice_items) {
      if (currentY < tableBottomMargin) {
        page = pdfDoc.addPage([595.28, 841.89]);
        pageHeight = page.getSize().height;
        pageWidth = page.getSize().width;
        currentY = pageHeight - PageMargin;
        currentY = await drawDeliveryNoteTableHeaders(page, currentY, fonts, pageWidth);
      }

      const itemLineHeight = LineHeight * 1.2;

      const itemTextOptionsBase: Omit<DrawTextOptions, 'font' | 'align' | 'maxWidth'> = {
        size: FontSizes.body,
        color: Colors.neutralDarker,
      };
      const optionsForThisRow: DrawTextOptions = {
        font: font,
        ...itemTextOptionsBase,
        lineHeight: itemLineHeight,
      };

      const colWidths = [0.70, 0.30];
      const tableWidth = pageWidth - 2 * PageMargin;

      const descriptionX = PageMargin;
      const descriptionMaxWidth = tableWidth * colWidths[0] - 5;

      const quantityX = PageMargin + tableWidth * colWidths[0];
      const quantityMaxWidth = tableWidth * colWidths[1] - 5;

      const tempY = currentY;

      // Draw product name (bold, single line)
      const productName = item.product?.name || 'Unnamed Product';
      const productNameFontSize = FontSizes.body - 1;
      const productNameLineHeight = productNameFontSize * 1.2;

      page.drawText(productName, {
        x: descriptionX,
        y: tempY,
        size: productNameFontSize,
        font: boldFont,
      });

      // Draw description (multi-line)
      const descriptionFontSize = FontSizes.small;
      const descriptionLineHeight = descriptionFontSize * 0.55;

      const descStartY = tempY - productNameLineHeight;

      const finalDescY = drawMultiLineText(
        page,
        item.product?.description || item.description || '',
        descStartY,
        descriptionX,
        {
          font,
          size: descriptionFontSize,
          lineHeight: descriptionLineHeight,
          maxWidth: descriptionMaxWidth,
          color: Colors.neutralDarker,
        },
        pageWidth
      );

      // Draw quantity (aligned to product name top)
      drawTextLine(page, item.quantity.toString(), tempY, quantityX, {
        ...optionsForThisRow,
        align: 'right',
        maxWidth: quantityMaxWidth,
      });

      // Separator line
      const lineY = finalDescY - 5;
      page.drawLine({
        start: { x: PageMargin, y: lineY },
        end: { x: pageWidth - PageMargin, y: lineY },
        thickness: 0.5,
        color: Colors.neutralLight,
      });

      // Update currentY
      currentY = lineY - 10;
    }

    currentY -= SectionSpacing * 0.5;

    // ======== 4. FOOTER (NOTES ONLY) ========
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

    if (invoice.notes) {
      currentY = drawTextLine(page, "Notes:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, invoice.notes, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
      currentY -= LineHeight * 0.5;
    }

    // Add delivery confirmation section
    currentY -= SectionSpacing;
    currentY = drawTextLine(page, "Delivery Confirmation:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
    currentY -= LineHeight;
    
    currentY = drawTextLine(page, "Received by: ________________________", currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, "Date: ________________________", currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, "Signature: ________________________", currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });

    const finalMessage = sanitizePdfText(`For any questions regarding this delivery, please contact ${sanitizePdfText(companyProfile.contact) || sanitizePdfText(companyProfile.name)}.`);
    const finalMessageYPosition = Math.min(currentY, PageMargin + LineHeight * 2); 
     if (finalMessageYPosition < PageMargin) { 
        page = pdfDoc.addPage([595.28, 841.89]);
        drawTextLine(page, finalMessage, PageMargin + LineHeight, PageMargin, { font: font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin});
    } else {
        drawTextLine(page, finalMessage, finalMessageYPosition, PageMargin, { font: font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin});
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="delivery-note-${sanitizePdfText(invoice.invoice_number)}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating delivery note PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating delivery note PDF: ${errorMessage}`, { status: 500 });
  }
}