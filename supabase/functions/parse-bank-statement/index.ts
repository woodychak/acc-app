import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Common bank statement CSV column names
const DEBIT_COLUMNS = ["debit", "withdrawal", "debit amount", "amount out", "dr", "charge", "payment"];
const CREDIT_COLUMNS = ["credit", "deposit", "credit amount", "amount in", "cr", "deposit amount"];
const DATE_COLUMNS = ["date", "transaction date", "trans date", "value date", "posting date"];
const DESC_COLUMNS = ["description", "narrative", "details", "particulars", "memo", "transaction", "reference"];
const AMOUNT_COLUMNS = ["amount", "transaction amount", "net amount"];

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const h of headers) {
    const idx = candidates.indexOf(h.toLowerCase().trim());
    if (idx !== -1) {
      return headers.findIndex(
        (header) => header.toLowerCase().trim() === candidates[idx]
      );
    }
  }
  return -1;
}

function parseAmount(val: string): number {
  if (!val || val.trim() === "" || val.trim() === "-") return 0;
  // Remove currency symbols, spaces, page-break markers
  const cleaned = val
    .replace(/[,$€£¥\s]/g, "")
    .replace(/\(([0-9.]+)\)/, "-$1");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

function cleanContent(raw: string): string {
  // Remove page-break markers inserted by client
  return raw.replace(/---PAGE BREAK---/g, "\n");
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === "") return null;
  const d = new Date(val.trim());
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  // Try DD/MM/YYYY
  const parts = val.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [d1, d2, d3] = parts;
    if (d3.length === 4) {
      const date = new Date(`${d3}-${d2.padStart(2, "0")}-${d1.padStart(2, "0")}`);
      if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    }
  }
  return null;
}

function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("amazon") || desc.includes("shop") || desc.includes("store") || desc.includes("mart") || desc.includes("retail")) return "Office Supplies";
  if (desc.includes("hotel") || desc.includes("flight") || desc.includes("airline") || desc.includes("uber") || desc.includes("lyft") || desc.includes("taxi") || desc.includes("train")) return "Travel";
  if (desc.includes("restaurant") || desc.includes("cafe") || desc.includes("coffee") || desc.includes("food") || desc.includes("dining") || desc.includes("lunch") || desc.includes("dinner")) return "Meals & Entertainment";
  if (desc.includes("software") || desc.includes("saas") || desc.includes("subscription") || desc.includes("netflix") || desc.includes("spotify") || desc.includes("adobe") || desc.includes("microsoft") || desc.includes("google")) return "Software & Subscriptions";
  if (desc.includes("marketing") || desc.includes("advertising") || desc.includes("ads") || desc.includes("facebook") || desc.includes("instagram")) return "Marketing & Advertising";
  if (desc.includes("lawyer") || desc.includes("attorney") || desc.includes("consultant") || desc.includes("accounting") || desc.includes("audit")) return "Professional Services";
  if (desc.includes("electric") || desc.includes("water") || desc.includes("gas") || desc.includes("internet") || desc.includes("phone") || desc.includes("utility")) return "Utilities";
  if (desc.includes("rent") || desc.includes("lease") || desc.includes("office")) return "Rent";
  if (desc.includes("insurance")) return "Insurance";
  return "Other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json();
    const { csvContent, pdfText, month, year, fileName, importId, currencyCode, defaultCategory, fileType } = body;

    const content = cleanContent(csvContent || pdfText || "");
    if (!content || !month || !year) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const isPdf = fileType === "pdf" || !!pdfText;
    const transactions = [];
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);
    let skipped = 0;
    let totalRows = 0;

    if (isPdf) {
      // Try AI parsing first (OpenAI), fall back to regex if no key
      const openAiKey = Deno.env.get("OPENAI_API_KEY");

      if (openAiKey) {
        // === AI-powered PDF parsing via OpenAI ===
        const prompt = `You are an expert bank statement parser. Extract ALL withdrawal/debit transactions from the bank statement text below.
The text was extracted from a PDF using positional reconstruction — each original row is on its own line, with columns separated by spaces.
Return a JSON array where each element has these exact keys:
- "date": transaction date as YYYY-MM-DD string (parse any format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, "12 Jan 2024", etc.)
- "description": merchant or transaction description (string, keep it concise)
- "withdrawal": the withdrawal/debit amount as a positive number (use 0 if it is a deposit/credit/balance line)

Rules:
- Only include rows that have a valid date AND withdrawal > 0.
- Skip header rows, footer rows, opening/closing balance lines, deposit/credit entries.
- If a line has two amounts (e.g. debit and credit columns), use the one in the debit/withdrawal column.
- If an amount appears negative or in parentheses, treat it as positive (it is a debit).

Bank statement text:
---
${content.substring(0, 14000)}
---
Return ONLY a valid JSON array, no markdown, no explanation.`;


        let aiRows: Array<{ date: string; description: string; withdrawal: number }> = [];
        try {
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0,
              max_tokens: 4096,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const rawText = aiData.choices?.[0]?.message?.content?.trim() || "[]";
            // Strip markdown code fences if present
            const jsonText = rawText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
            aiRows = JSON.parse(jsonText);
          }
        } catch (_e) {
          // Fall through to regex parsing below
          aiRows = [];
        }

        totalRows = aiRows.length;

        for (const row of aiRows) {
          const parsedDate = parseDate(row.date);
          if (!parsedDate) { skipped++; continue; }

          const txDate = new Date(parsedDate);
          if (txDate.getMonth() + 1 !== targetMonth || txDate.getFullYear() !== targetYear) {
            skipped++;
            continue;
          }

          const amount = Math.abs(Number(row.withdrawal) || 0);
          if (amount <= 0) { skipped++; continue; }

          const descVal = (row.description || `Transaction ${parsedDate}`).substring(0, 200);
          const category = defaultCategory || categorizeTransaction(descVal);

          transactions.push({
            user_id: user.id,
            title: descVal,
            description: `Imported from bank statement: ${fileName || "statement"}`,
            amount,
            currency_code: currencyCode || "USD",
            category,
            expense_date: parsedDate,
            payment_method: "Bank Transfer",
            vendor: descVal.substring(0, 100),
            notes: `Auto-imported from PDF bank statement via AI (${month}/${year})`,
          });
        }

        // If AI returned nothing, fall back to regex
        if (aiRows.length === 0) {
          const lines = content.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          totalRows = lines.length;
          const datePatterns = [
            /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/,
            /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,
            /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
          ];
          for (const line of lines) {
            let parsedDate: string | null = null;
            for (const pat of datePatterns) {
              const m = line.match(pat);
              if (m) { parsedDate = parseDate(m[0]); if (parsedDate) break; }
            }
            if (!parsedDate) { skipped++; continue; }
            const txDate = new Date(parsedDate);
            if (txDate.getMonth() + 1 !== targetMonth || txDate.getFullYear() !== targetYear) { skipped++; continue; }
            const allAmounts = line.match(/[-\(]?\d{1,3}(?:[,\d{3}])*(?:\.\d{1,2})?\)?/g);
            if (!allAmounts || allAmounts.length === 0) { skipped++; continue; }
            const rawAmt = allAmounts[allAmounts.length - 1];
            const amount = parseAmount(rawAmt);
            if (amount <= 0) { skipped++; continue; }
            let descVal = line
              .replace(datePatterns[0], "").replace(datePatterns[1], "")
              .replace(new RegExp(rawAmt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "")
              .replace(/\s+/g, " ").trim();
            if (!descVal || descVal.length < 3) descVal = `Transaction ${parsedDate}`;
            const category = defaultCategory || categorizeTransaction(descVal);
            transactions.push({
              user_id: user.id,
              title: descVal.substring(0, 200),
              description: `Imported from bank statement: ${fileName || "statement"}`,
              amount,
              currency_code: currencyCode || "USD",
              category,
              expense_date: parsedDate,
              payment_method: "Bank Transfer",
              vendor: descVal.substring(0, 100),
              notes: `Auto-imported from PDF bank statement (${month}/${year})`,
            });
          }
        }
      } else {
        // === Regex-based PDF parsing (no AI key) ===
        const lines = content.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        totalRows = lines.length;

        const datePatterns = [
          /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/,
          /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,
          /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})[,\s]+(\d{4})\b/i,
        ];

        for (const line of lines) {
          let parsedDate: string | null = null;
          for (const pat of datePatterns) {
            const m = line.match(pat);
            if (m) { parsedDate = parseDate(m[0]); if (parsedDate) break; }
          }
          if (!parsedDate) { skipped++; continue; }

          const txDate = new Date(parsedDate);
          if (txDate.getMonth() + 1 !== targetMonth || txDate.getFullYear() !== targetYear) { skipped++; continue; }

          const allAmounts = line.match(/[-\(]?\d{1,3}(?:[,\d{3}])*(?:\.\d{1,2})?\)?/g);
          if (!allAmounts || allAmounts.length === 0) { skipped++; continue; }

          const rawAmt = allAmounts[allAmounts.length - 1];
          const amount = parseAmount(rawAmt);
          if (amount <= 0) { skipped++; continue; }

          let descVal = line
            .replace(datePatterns[0], "").replace(datePatterns[1], "")
            .replace(new RegExp(rawAmt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "")
            .replace(/\s+/g, " ").trim();
          if (!descVal || descVal.length < 3) descVal = `Transaction ${parsedDate}`;

          const category = defaultCategory || categorizeTransaction(descVal);

          transactions.push({
            user_id: user.id,
            title: descVal.substring(0, 200),
            description: `Imported from bank statement: ${fileName || "statement"}`,
            amount,
            currency_code: currencyCode || "USD",
            category,
            expense_date: parsedDate,
            payment_method: "Bank Transfer",
            vendor: descVal.substring(0, 100),
            notes: `Auto-imported from PDF bank statement (${month}/${year})`,
          });
        }
      }
    } else {
      // Parse CSV
      const lines = content.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      if (lines.length < 2) {
        return new Response(JSON.stringify({ error: "CSV file is empty or has no data rows" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      totalRows = lines.length - 1;

      // Parse headers
      const rawHeaders = lines[0].split(",").map((h: string) => h.replace(/"/g, "").trim());

      const dateIdx = findColumnIndex(rawHeaders, DATE_COLUMNS);
      const descIdx = findColumnIndex(rawHeaders, DESC_COLUMNS);
      const debitIdx = findColumnIndex(rawHeaders, DEBIT_COLUMNS);
      const creditIdx = findColumnIndex(rawHeaders, CREDIT_COLUMNS);
      const amountIdx = findColumnIndex(rawHeaders, AMOUNT_COLUMNS);

      if (dateIdx === -1 || descIdx === -1) {
        return new Response(
          JSON.stringify({
            error: `Could not detect required columns. Found headers: ${rawHeaders.join(", ")}. Expected date column (${DATE_COLUMNS.join("/")}) and description column (${DESC_COLUMNS.join("/")}).`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV splitting - handle quoted fields
        const row: string[] = [];
        let inQuote = false;
        let field = "";
        for (const char of lines[i]) {
          if (char === '"') { inQuote = !inQuote; }
          else if (char === "," && !inQuote) { row.push(field); field = ""; }
          else { field += char; }
        }
        row.push(field);

        const dateVal = row[dateIdx]?.replace(/"/g, "").trim();
        const descVal = row[descIdx]?.replace(/"/g, "").trim() || `Transaction ${i}`;

        const parsedDate = parseDate(dateVal);
        if (!parsedDate) { skipped++; continue; }

        // Filter by month/year
        const txDate = new Date(parsedDate);
        if (txDate.getMonth() + 1 !== targetMonth || txDate.getFullYear() !== targetYear) {
          skipped++;
          continue;
        }

        // Figure out amount - debit only (payouts)
        let amount = 0;
        if (debitIdx !== -1) {
          amount = parseAmount(row[debitIdx]?.replace(/"/g, "") || "");
        } else if (amountIdx !== -1) {
          const rawAmt = row[amountIdx]?.replace(/"/g, "") || "";
          const parsed = parseFloat(rawAmt.replace(/[,$\s]/g, ""));
          // Negative amounts are debits
          if (!isNaN(parsed) && parsed < 0) {
            amount = Math.abs(parsed);
          } else if (!isNaN(parsed) && parsed > 0) {
            // If no separate credit column, check credit col
            if (creditIdx !== -1) {
              amount = parsed; // it's a debit
            }
          }
        }

        if (amount <= 0) { skipped++; continue; } // Skip credits/zero entries

        const category = defaultCategory || categorizeTransaction(descVal);

        transactions.push({
          user_id: user.id,
          title: descVal.substring(0, 200),
          description: `Imported from bank statement: ${fileName || "statement"}`,
          amount,
          currency_code: currencyCode || "USD",
          category,
          expense_date: parsedDate,
          payment_method: "Bank Transfer",
          vendor: descVal.substring(0, 100),
          notes: `Auto-imported from bank statement (${month}/${year})`,
        });
      }
    }

    // Batch insert expenses
    let importedCount = 0;
    if (transactions.length > 0) {
      const { error: insertError } = await supabase.from("expenses").insert(transactions);
      if (insertError) throw insertError;
      importedCount = transactions.length;
    }

    // Update import record if importId provided
    if (importId) {
      await supabase
        .from("bank_statement_imports")
        .update({
          status: "completed",
          total_transactions: totalRows,
          imported_count: importedCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId)
        .eq("user_id", user.id);
    }

    const usedAi = isPdf && !!Deno.env.get("OPENAI_API_KEY");

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        skipped,
        total: totalRows,
        aiParsed: usedAi,
        message: `Successfully imported ${importedCount} expense${importedCount !== 1 ? "s" : ""} from your bank statement${usedAi ? " (AI-parsed)" : ""}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
