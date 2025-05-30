// app/api/invoices/[id]/pdf/route.ts
import { createClient } from "../../../../../supabase/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { NextRequest } from "next/server";

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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_items(*)")
    .eq("id", params.id)
    .single();

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const { data: company } = await supabase
    .from("company_profile")
    .select("*")
    .limit(1)
    .single();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = height - 50;

  page.drawText(company?.name || "Your Company", { x: 50, y, size: 20, font });
  y -= 30;
  page.drawText(`Invoice #: ${invoice.invoice_number}`, {
    x: 50,
    y,
    size: 14,
    font,
  });
  y -= 20;
  page.drawText(`Customer: ${invoice.customers?.name}`, {
    x: 50,
    y,
    size: 14,
    font,
  });
  y -= 20;
  page.drawText(`Date: ${invoice.issue_date}`, { x: 50, y, size: 14, font });

  y -= 30;
  invoice.invoice_items.forEach((item: any) => {
    page.drawText(
      `${item.description} - ${item.quantity} x ${item.unit_price}`,
      {
        x: 50,
        y,
        size: 12,
        font,
      },
    );
    y -= 15;
  });

  y -= 20;
  page.drawText(`Total: ${invoice.total_amount} ${invoice.currency_code}`, {
    x: 50,
    y,
    size: 14,
    font,
    color: rgb(0, 0.5, 0),
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
