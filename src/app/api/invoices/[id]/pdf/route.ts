
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../supabase/server"; // Adjust path as needed
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, cmyk } from "pdf-lib";
import type { Invoice, Customer, InvoiceItems, CompanyProfile } from "../../../../types"; // Assuming types.ts is in the same directory or adjust path

// Helper function to fetch data with retries (basic example)
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500 && i === retries - 1) { // Don't retry client errors on last attempt
        return response; // Return the client error response
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
  primary: rgb(59 / 255, 130 / 255, 246 / 255), // Blue-500
  primaryDark: rgb(37 / 255, 99 / 255, 235 / 255), // Blue-600
  neutralDarker: rgb(31 / 255, 41 / 255, 55 / 255), // Gray-800
  neutralDark: rgb(75 / 255, 85 / 255, 99 / 255), // Gray-600
  neutralMedium: rgb(209 / 255, 213 / 255, 219 / 255), // Gray-300
  neutralLight: rgb(243 / 255, 244 / 255, 246 / 255), // Gray-100
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  transparent: cmyk(0,0,0,0), // For height calculation
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
const SectionSpacing = 20;
const MinHeaderHeightPoints = 150; // Minimum height for the header section

// Helper to sanitize text for PDF, removing problematic characters
const sanitizePdfText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

// Helper to format date
const formatDatePdf = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Helper to format currency
const formatCurrencyPdf = (amount: number, currencyCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
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
  x: number, // Base x for alignment
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
  const sanitizedText = sanitizePdfText(text); // Sanitize before use

  let drawX = x;
  // Adjust X for alignment if font and maxWidth are provided
  if (font && maxWidth != null) { // Check for null or undefined explicitly
    if (align === 'right') {
      const textWidth = font.widthOfTextAtSize(sanitizedText, size);
      drawX = x + maxWidth - textWidth;
    } else if (align === 'center') {
      const textWidth = font.widthOfTextAtSize(sanitizedText, size);
      drawX = x + (maxWidth - textWidth) / 2;
    }
  }
  if (color !== Colors.transparent) { // Only draw if not transparent
    page.drawText(sanitizedText, {
      x: drawX,
      y: currentY,
      font, // Font must be provided in options if not relying on pdf-lib default
      size,
      color: color as ReturnType<typeof rgb>, // Cast because cmyk is only for measurement
    });
  }
  return currentY - resolvedLineHeight;
}

// Function to draw multiple lines of text (basic implementation for \n and word wrapping)
function drawMultiLineText(
  page: PDFPage,
  text: string,
  currentY: number,
  x: number,
  options: DrawTextOptions = {},
  pageWidth: number
): number {
  const sanitizedText = sanitizePdfText(text); // Sanitize at the beginning
  const lines = sanitizedText.split('\n');
  let y = currentY;

  const effectiveMaxWidth = options.maxWidth ?? (pageWidth - x - PageMargin);
  
  const drawOptions: DrawTextOptions = {
    ...options,
    maxWidth: effectiveMaxWidth,
  };
  
  const { font, size = FontSizes.body } = drawOptions; 

  for (const line of lines) {
    let currentLine = line;
    if (font && effectiveMaxWidth > 0) { 
      while (font.widthOfTextAtSize(currentLine, size) > effectiveMaxWidth && currentLine.length > 0) {
        let breakPoint = currentLine.length - 1;
        while (breakPoint > 0 && font.widthOfTextAtSize(currentLine.substring(0, breakPoint), size) > effectiveMaxWidth) {
          breakPoint--;
        }
        const lastSpace = currentLine.substring(0, breakPoint).lastIndexOf(' ');
        if (lastSpace !== -1 && font.widthOfTextAtSize(currentLine.substring(0, lastSpace), size) <= effectiveMaxWidth) {
          breakPoint = lastSpace;
        } else if (breakPoint === 0 && currentLine.length > 0) { 
            let tempBreakPoint = 0;
             while(tempBreakPoint < currentLine.length && font.widthOfTextAtSize(currentLine.substring(0, tempBreakPoint + 1), size) <= effectiveMaxWidth) {
                 tempBreakPoint++;
             }
             breakPoint = Math.max(0, tempBreakPoint -1); 
             if (breakPoint === 0 && currentLine.length > 1 && font.widthOfTextAtSize(currentLine.substring(0,1), size) > effectiveMaxWidth) {
                // This case is rare, character too wide. Will likely draw truncated/overflow.
             } else if (breakPoint === 0 && currentLine.length > 0) {
                breakPoint = currentLine.substring(0, Math.max(1, effectiveMaxWidth / (font.widthOfTextAtSize("M",size) || 1 ))).length; // Estimate
             }
        }
        
        const partToDraw = currentLine.substring(0, breakPoint);
        // Pass sanitized partToDraw (already sanitized as part of `currentLine`)
        y = drawTextLine(page, partToDraw, y, x, drawOptions); 
        currentLine = currentLine.substring(breakPoint).trimStart();
      }
    }
    if (currentLine.length > 0) {
       // Pass sanitized currentLine
       y = drawTextLine(page, currentLine, y, x, drawOptions); 
    }
  }
  return y;
}


async function drawInvoiceTableHeaders(page: PDFPage, y: number, fonts: { regular: PDFFont, bold: PDFFont }, pageWidth: number): Promise<number> {
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

  // Text for headers is static, so sanitization is not strictly needed here unless these strings could somehow get \r
  page.drawText(sanitizePdfText("Description"), { x: descColX, y: currentY, ...headerBaseOptions });
  
  let text = sanitizePdfText("Quantity");
  let textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: qtyColX + qtyColWidth - textWidth, y: currentY, ...headerBaseOptions });

  text = sanitizePdfText("Unit Price");
  textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: unitPriceColX + unitPriceColWidth - textWidth, y: currentY, ...headerBaseOptions });
  
  text = sanitizePdfText("Tax Rate");
  textWidth = fonts.bold.widthOfTextAtSize(text, FontSizes.tableHeader);
  page.drawText(text, { x: taxRateColX + taxRateColWidth - textWidth, y: currentY, ...headerBaseOptions });

  text = sanitizePdfText("Line Total");
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

const calculateLineTotalWithTax = (item: InvoiceItems): number => {
    const baseTotal = item.quantity * item.unit_price;
    if (item.tax_rate && item.tax_rate > 0) {
      return baseTotal * (1 + item.tax_rate / 100);
    }
    return baseTotal;
};


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
        invoice_items(*)
      `,
      )
      .eq("id", params.id)
      .single<Invoice>(); 

    if (invoiceError || !invoiceData) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(`Invoice not found: ${invoiceError?.message || 'Unknown error'}`, { status: 404 });
    }
     if (!invoiceData.customer) {
        console.error("Invoice is missing customer data:", invoiceData);
        return new Response("Invoice data is incomplete: missing customer", { status: 500 });
    }
    // Type cast to ensure invoice is treated as Invoice, not Invoice | null
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
      const logoUrl = companyProfile.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sanitizePdfText(companyProfile.name) || "C")}&backgroundColor=3B82F6&textColor=ffffff&fontSize=40&radius=10&format=png`; // force png
      const logoResponse = await fetchWithRetry(logoUrl);
      if (logoResponse.ok) {
        const logoImageBytes = await logoResponse.arrayBuffer();
        try {
          logoImage = await pdfDoc.embedPng(new Uint8Array(logoImageBytes));
        } catch (e) {
          try {
             logoImage = await pdfDoc.embedJpg(new Uint8Array(logoImageBytes));
          } catch (e2) {
            console.warn("Could not embed logo as PNG or JPG:", e2);
          }
        }

        if (logoImage) {
          const dims = logoImage.scaleToFit(maxLogoWidth, maxLogoHeight);
          logoHeight = dims.height; 
          page.drawImage(logoImage, {
            x: PageMargin,
            y: currentY - logoHeight, 
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
    
    let leftY = initialHeaderY - (logoImage ? logoHeight + 10 : 0); 
    if (!logoImage) {
        leftY = initialHeaderY; 
    }

    leftY = drawTextLine(page, companyProfile.name, leftY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (companyProfile.address) leftY = drawMultiLineText(page, companyProfile.address, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
    //if (companyProfile.city_state_zip) leftY = drawTextLine(page, companyProfile.city_state_zip, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    //if (companyProfile.country) leftY = drawTextLine(page, companyProfile.country, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (companyProfile.tel) leftY = drawTextLine(page, `Tel: ${sanitizePdfText(companyProfile.tel)}`, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (companyProfile.contact) leftY = drawTextLine(page, `Email: ${sanitizePdfText(companyProfile.contact)}`, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    //if (companyProfile.website) leftY = drawTextLine(page, `Web: ${sanitizePdfText(companyProfile.website)}`, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    //if (companyProfile.tax_id) leftY = drawTextLine(page, `Tax ID: ${sanitizePdfText(companyProfile.tax_id)}`, leftY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, lineHeight: LineHeight *1.5 });

    let rightY = initialHeaderY; 
    rightY = drawTextLine(page, "INVOICE", rightY, headerRightX, { font: boldFont, size: FontSizes.title, color: Colors.primary, align: 'right', maxWidth: headerRightWidth });
    rightY = drawTextLine(page, `# ${sanitizePdfText(invoice.invoice_number)}`, rightY, headerRightX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, align: 'right', maxWidth: headerRightWidth });
    
    rightY -= LineHeight * 0.5; 
    
    rightY = drawTextLine(page, `Date Issued: ${formatDatePdf(invoice.issue_date)}`, rightY, headerRightX, {font: font, size:FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth});
    rightY = drawTextLine(page, `Date Due: ${formatDatePdf(invoice.due_date)}`, rightY, headerRightX, {font: font, size:FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth});

    if (invoice.status) {
        rightY -= LineHeight * 0.5; 
        const statusText = `Status: ${sanitizePdfText(invoice.status).toUpperCase()}`;
        const statusTextWidth = boldFont.widthOfTextAtSize(statusText, FontSizes.body);
        const badgePaddingHorizontal = 8; 
        const badgePaddingVertical = 3;
        const badgeContentWidth = statusTextWidth + badgePaddingHorizontal * 2;
        
        const badgeX = headerRightX + headerRightWidth - badgeContentWidth;
        const badgeHeight = FontSizes.body + badgePaddingVertical * 2;
        const badgeRectY = rightY - badgeHeight + (badgePaddingVertical*0.8); 

        page.drawRectangle({
            x: badgeX,
            y: badgeRectY,
            width: badgeContentWidth,
            height: badgeHeight,
            color: Colors.primaryDark,
        });
        
        const textYForBadge = badgeRectY + badgePaddingVertical;
        drawTextLine(page, statusText, textYForBadge , badgeX + badgePaddingHorizontal, {font: boldFont, size: FontSizes.body, color: Colors.white, lineHeight: FontSizes.body });
        rightY -= badgeHeight; 
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

    // ======== 2. BILL TO SECTION ========
    currentY = drawTextLine(page, "Bill To:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, invoice.customer.name, currentY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (invoice.customer.address) currentY = drawMultiLineText(page, invoice.customer.address, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
    if (invoice.customer.email) currentY = drawTextLine(page, invoice.customer.email, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (invoice.customer.phone) currentY = drawTextLine(page, invoice.customer.phone, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    
    currentY -= SectionSpacing;

    // ======== 3. ITEMS TABLE ========
    currentY = await drawInvoiceTableHeaders(page, currentY, fonts, pageWidth);

    const tableBottomMargin = PageMargin + 200; 

    for (const item of invoice.invoice_items) {
      if (currentY < tableBottomMargin) {
        page = pdfDoc.addPage([595.28, 841.89]);
        pageHeight = page.getSize().height;
        pageWidth = page.getSize().width;
        currentY = pageHeight - PageMargin;
        currentY = await drawInvoiceTableHeaders(page, currentY, fonts, pageWidth);
      }

      const lineTotalWithTax = calculateLineTotalWithTax(item);
      const itemTextOptionsBase: Omit<DrawTextOptions, 'font' | 'align' | 'maxWidth'> = { size: FontSizes.body, color: Colors.neutralDarker };
      
      const colWidths = [0.40, 0.15, 0.15, 0.15, 0.15];
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
      const lineTotalMaxWidth = tableWidth * colWidths[4] -5;
      
      const itemLineHeight = LineHeight * 1.2; 
      const optionsForThisRow : DrawTextOptions = {font: font, ...itemTextOptionsBase, lineHeight: itemLineHeight};

      const tempY = currentY; 
      let descriptionHeight = 0;
      let currentDescY = tempY;

      // Sanitize item.description before drawing
      const finalDescY = drawMultiLineText(page, item.description, currentDescY, descriptionX, {...optionsForThisRow, maxWidth: descriptionMaxWidth}, pageWidth);
      descriptionHeight = tempY - finalDescY; 

      drawTextLine(page, item.quantity.toString(), tempY, quantityX, { ...optionsForThisRow, align: 'right', maxWidth: quantityMaxWidth });
      drawTextLine(page, formatCurrencyPdf(item.unit_price, invoice.currency_code), tempY, unitPriceX, { ...optionsForThisRow, align: 'right', maxWidth: unitPriceMaxWidth });
      drawTextLine(page, item.tax_rate ? `${item.tax_rate}%` : "N/A", tempY, taxRateX, { ...optionsForThisRow, align: 'right', maxWidth: taxRateMaxWidth });
      drawTextLine(page, formatCurrencyPdf(lineTotalWithTax, invoice.currency_code), tempY, lineTotalX, { ...optionsForThisRow, font: boldFont, align: 'right', maxWidth: lineTotalMaxWidth });

      currentY = tempY - Math.max(itemLineHeight, descriptionHeight); 
      
      page.drawLine({
          start: { x: PageMargin, y: currentY + itemLineHeight * 0.2 }, 
          end: { x: pageWidth - PageMargin, y: currentY + itemLineHeight * 0.2 },
          thickness: 0.5,
          color: Colors.neutralMedium,
      });
    }
    currentY -= SectionSpacing * 0.5;

    // ======== 4. TOTALS SECTION ========
    const totalsX = pageWidth / 2; 
    const totalsLabelWidth = (pageWidth - PageMargin - totalsX) * 0.6; 
    const totalsValueX = totalsX + totalsLabelWidth; 
    const totalsValueWidth = (pageWidth - PageMargin - totalsX) * 0.4; 

    currentY = drawTextLine(page, `Subtotal:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
    drawTextLine(page, formatCurrencyPdf(invoice.subtotal, invoice.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });

    if (invoice.tax_amount > 0) {
      currentY = drawTextLine(page, `Tax:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, formatCurrencyPdf(invoice.tax_amount, invoice.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
    }
    if (invoice.discount_amount > 0) {
      currentY = drawTextLine(page, `Discount:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, `-${formatCurrencyPdf(invoice.discount_amount, invoice.currency_code)}`, currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
    }
    
    currentY -= LineHeight * 0.5;
    page.drawLine({
        start: { x: totalsX, y: currentY },
        end: { x: pageWidth - PageMargin, y: currentY },
        thickness: 1,
        color: Colors.neutralDarker,
    });
    currentY -= LineHeight * 1.2;

    currentY = drawTextLine(page, `Total Amount Due:`, currentY, totalsX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, maxWidth: totalsLabelWidth });
    drawTextLine(page, formatCurrencyPdf(invoice.total_amount, invoice.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.subHeader, color: Colors.primaryDark, align: 'right', maxWidth: totalsValueWidth });
    
    currentY -= SectionSpacing;

    // ======== 5. FOOTER (NOTES & PAYMENT TERMS) ========
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

    if (companyProfile.payment_terms) {
      currentY = drawTextLine(page, "Payment Terms:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, companyProfile.payment_terms, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
      currentY -= LineHeight * 0.5;
    }
    
    if (companyProfile.bank_account) {
        const bankDetailsPadding = 10;
        let bankDetailsContentY = currentY;
        
        let measureY = currentY;
        measureY = drawTextLine(page, "Bank Details:", measureY, PageMargin + bankDetailsPadding, { font: boldFont, size: FontSizes.body, color: Colors.transparent });
        measureY = drawMultiLineText(page, companyProfile.bank_account, measureY, PageMargin + bankDetailsPadding, { font: font, size: FontSizes.body, color: Colors.transparent, maxWidth: pageWidth - 2 * (PageMargin + bankDetailsPadding) }, pageWidth);
        const textBlockHeight = currentY - measureY;
        const bankDetailsRectHeight = textBlockHeight + bankDetailsPadding * 1.5; 

        if (currentY - bankDetailsRectHeight < PageMargin) { 
            page = pdfDoc.addPage([595.28, 841.89]);
            pageHeight = page.getSize().height;
            pageWidth = page.getSize().width;
            currentY = pageHeight - PageMargin;
            bankDetailsContentY = currentY; 
        }

        const bankDetailsRectY = bankDetailsContentY - bankDetailsRectHeight + bankDetailsPadding * 0.5;

        page.drawRectangle({
            x: PageMargin,
            y: bankDetailsRectY,
            width: pageWidth - PageMargin * 2,
            height: bankDetailsRectHeight,
            color: Colors.neutralLight,
            borderColor: Colors.neutralMedium,
            borderWidth: 0.5,
        });
        
        let actualDrawY = bankDetailsContentY - bankDetailsPadding * 0.5; 
        actualDrawY = drawTextLine(page, "Bank Details:", actualDrawY, PageMargin + bankDetailsPadding, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
        actualDrawY = drawMultiLineText(page, companyProfile.bank_account, actualDrawY, PageMargin + bankDetailsPadding, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * (PageMargin + bankDetailsPadding) }, pageWidth);
        currentY = bankDetailsRectY - LineHeight * 0.5; 
    }

    const finalMessage = sanitizePdfText(`If you have any questions concerning this invoice, please contact ${sanitizePdfText(companyProfile.contact) || sanitizePdfText(companyProfile.name)}.`);
    const finalMessageYPosition = Math.min(currentY, PageMargin + LineHeight * 2); 
     if (finalMessageYPosition < PageMargin) { 
        page = pdfDoc.addPage([595.28, 841.89]);
        // No need to update pageHeight/Width here as they aren't used after this for new page decisions
        drawTextLine(page, finalMessage, PageMargin + LineHeight, PageMargin, { font: font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin});
    } else {
        drawTextLine(page, finalMessage, finalMessageYPosition, PageMargin, { font: font, size: FontSizes.small, color: Colors.neutralDark, align: 'center', maxWidth: pageWidth - 2 * PageMargin});
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${sanitizePdfText(invoice.invoice_number)}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating PDF: ${errorMessage}`, { status: 500 });
  }
}
