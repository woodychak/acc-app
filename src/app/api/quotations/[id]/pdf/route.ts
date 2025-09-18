import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, cmyk } from "pdf-lib";
import { Quotation, Customer, QuotationItems, CompanyProfile } from "../../../../types";

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
  primary: rgb(59 / 255, 130 / 255, 246 / 255), // Blue-500
  primaryDark: rgb(37 / 255, 99 / 255, 235 / 255), // Blue-600
  neutralDarker: rgb(31 / 255, 41 / 255, 55 / 255), // Gray-800
  neutralDark: rgb(75 / 255, 85 / 255, 99 / 255), // Gray-600
  neutralMedium: rgb(209 / 255, 213 / 255, 219 / 255), // Gray-300
  neutralLight: rgb(243 / 255, 244 / 255, 246 / 255), // Gray-100
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
    .replace(/\t/g, '    ') // Replace tabs with 4 spaces
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/[^\x00-\xFF]/g, '?'); // Replace non-Latin characters
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

async function drawQuotationTableHeaders(page: PDFPage, y: number, fonts: { regular: PDFFont, bold: PDFFont }, pageWidth: number, currency_code: string): Promise<number> {
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

  text = sanitizePdfText("Unit Price");
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

const calculateLineTotalWithTax = (item: QuotationItems): number => {
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
    const { data: quotationData, error: quotationError } = await supabase
      .from("quotations")
      .select(
        `
        *,
        customer:customers(*), 
        quotation_items(*, product:products(name))
      `,
      )
      .eq("id", params.id)
      .single(); 

    if (quotationError || !quotationData) {
      console.error("Error fetching quotation:", quotationError);
      return new Response(`Quotation not found: ${quotationError?.message || 'Unknown error'}`, { status: 404 });
    }
     if (!quotationData.customer) {
        console.error("Quotation is missing customer data:", quotationData);
        return new Response("Quotation data is incomplete: missing customer", { status: 500 });
    }
    const quotation: Quotation = quotationData as Quotation;

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
    rightY = drawTextLine(page, "QUOTATION", rightY, headerRightX, { font: boldFont, size: FontSizes.title, color: Colors.primary, align: 'right', maxWidth: headerRightWidth });
    rightY = drawTextLine(page, `# ${sanitizePdfText(quotation.quotation_number)}`, rightY, headerRightX, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker, align: 'right', maxWidth: headerRightWidth });
    
    rightY -= LineHeight * 0.5; 
    
    rightY = drawTextLine(page, `Date Issued: ${formatDatePdf(quotation.issue_date)}`, rightY, headerRightX, {font: font, size:FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth});
    rightY = drawTextLine(page, `Valid Until: ${formatDatePdf(quotation.valid_until)}`, rightY, headerRightX, {font: font, size:FontSizes.body, color: Colors.neutralDark, align: 'right', maxWidth: headerRightWidth});

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

    // ======== 2. QUOTE TO SECTION ========
    currentY = drawTextLine(page, "Quote To:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDark });
    currentY = drawTextLine(page, quotation.customer.name, currentY, PageMargin, { font: boldFont, size: FontSizes.subHeader, color: Colors.neutralDarker });
    if (quotation.customer.address) currentY = drawMultiLineText(page, quotation.customer.address, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark }, pageWidth);
    if (quotation.customer.email) currentY = drawTextLine(page, quotation.customer.email, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    if (quotation.customer.phone) currentY = drawTextLine(page, quotation.customer.phone, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark });
    
    currentY -= SectionSpacing;

   // ======== 3. ITEMS TABLE ========
currentY = await drawQuotationTableHeaders(page, currentY, fonts, pageWidth, quotation.currency_code);

const tableBottomMargin = PageMargin + 200;

for (const item of quotation.quotation_items) {
  if (currentY < tableBottomMargin) {
    page = pdfDoc.addPage([595.28, 841.89]);
    pageHeight = page.getSize().height;
    pageWidth = page.getSize().width;
    currentY = pageHeight - PageMargin;
    currentY = await drawQuotationTableHeaders(page, currentY, fonts, pageWidth, quotation.currency_code);
  }

  const lineTotalWithTax = calculateLineTotalWithTax(item);
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

  // 1. Draw product name (bold, single line)
const productName = item.product?.name || 'Unnamed Product';
const productNameFontSize = FontSizes.body - 1;
const productNameLineHeight = productNameFontSize * 1.2;

page.drawText(productName, {
  x: descriptionX,
  y: tempY,
  size: productNameFontSize,
  font: boldFont,
});

// 2. Draw description (multi-line)
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

const descriptionHeight = tempY - finalDescY;

  // 3. Draw right side values (aligned to product name top)
  drawTextLine(page, item.quantity.toString(), tempY, quantityX, {
    ...optionsForThisRow,
    align: 'right',
    maxWidth: quantityMaxWidth,
  });

  drawTextLine(
    page,
    formatCurrencyPdf(item.unit_price, quotation.currency_code),
    tempY,
    unitPriceX,
    {
      ...optionsForThisRow,
      align: 'right',
      maxWidth: unitPriceMaxWidth,
    }
  );

  drawTextLine(
    page,
    item.tax_rate ? `${item.tax_rate}%` : '0%',
    tempY,
    taxRateX,
    {
      ...optionsForThisRow,
      align: 'right',
      maxWidth: taxRateMaxWidth,
    }
  );

  drawTextLine(
    page,
    formatCurrencyPdf(lineTotalWithTax, quotation.currency_code),
    tempY,
    lineTotalX,
    {
      ...optionsForThisRow,
      font: boldFont,
      align: 'right',
      maxWidth: lineTotalMaxWidth,
    }
  );

  // 4. Separator line
  const lineY = finalDescY - 5;
  page.drawLine({
    start: { x: PageMargin, y: lineY },
    end: { x: pageWidth - PageMargin, y: lineY },
    thickness: 0.5,
    color: Colors.neutralLight,
  });

  // 5. Update currentY
  currentY = lineY - 10;
}

currentY -= SectionSpacing * 0.5;

    // ======== 4. TOTALS SECTION ========
    const totalsX = pageWidth / 2; 
    const totalsLabelWidth = (pageWidth - PageMargin - totalsX) * 0.6; 
    const totalsValueX = totalsX + totalsLabelWidth; 
    const totalsValueWidth = (pageWidth - PageMargin - totalsX) * 0.4; 

    currentY = drawTextLine(page, `Subtotal:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
    drawTextLine(page, formatCurrencyPdf(quotation.subtotal, quotation.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });

    if (quotation.tax_amount > 0) {
      currentY = drawTextLine(page, `Tax:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, formatCurrencyPdf(quotation.tax_amount, quotation.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
    }
    if (quotation.discount_amount > 0) {
      currentY = drawTextLine(page, `Discount:`, currentY, totalsX, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: totalsLabelWidth });
      drawTextLine(page, `-${formatCurrencyPdf(quotation.discount_amount, quotation.currency_code)}`, currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker, align: 'right', maxWidth: totalsValueWidth });
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
    drawTextLine(page, formatCurrencyPdf(quotation.total_amount, quotation.currency_code), currentY + LineHeight, totalsValueX, { font: boldFont, size: FontSizes.subHeader, color: Colors.primaryDark, align: 'right', maxWidth: totalsValueWidth });
    
    currentY -= SectionSpacing;

    // ======== 5. FOOTER (NOTES & TERMS) ========
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

    if (quotation.notes) {
      currentY = drawTextLine(page, "Notes:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, quotation.notes, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
      currentY -= LineHeight * 0.5;
    }

    if (quotation.terms_conditions) {
      currentY = drawTextLine(page, "Terms & Conditions:", currentY, PageMargin, { font: boldFont, size: FontSizes.body, color: Colors.neutralDarker });
      currentY = drawMultiLineText(page, quotation.terms_conditions, currentY, PageMargin, { font: font, size: FontSizes.body, color: Colors.neutralDark, maxWidth: pageWidth - 2 * PageMargin }, pageWidth);
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
        const bankDetailsRectHeight = textBlockHeight + bankDetailsPadding * 0.5; 

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
        actualDrawY = drawMultiLineText(page, companyProfile.bank_account, actualDrawY, PageMargin + bankDetailsPadding, { font: font, size: FontSizes.body, color: Colors.neutralDark, lineHeight: FontSizes.body * 0.7, maxWidth: pageWidth - 2 * (PageMargin + bankDetailsPadding) }, pageWidth);
        currentY = bankDetailsRectY - LineHeight * 0.5; 
    }

    const finalMessage = sanitizePdfText(`If you have any questions concerning this quotation, please contact ${sanitizePdfText(companyProfile.contact) || sanitizePdfText(companyProfile.name)}.`);
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
        "Content-Disposition": `attachment; filename="quotation-${sanitizePdfText(quotation.quotation_number)}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating PDF: ${errorMessage}`, { status: 500 });
  }
}