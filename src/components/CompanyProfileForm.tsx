"use client";

import { useFormState } from "react-dom";
import { updateCompanyProfileAction } from "@/app/dashboard/company-profile/actions";
import { testSmtpAction } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { useState } from "react";

export function CompanyProfileForm({
  data,
  isSetup,
}: {
  data: any;
  isSetup: boolean;
}) {
  const [state, formAction] = useFormState(updateCompanyProfileAction, null);
  const [testEmail, setTestEmail] = useState("");
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingSmtp(true);
    setTestResult(null);

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form.closest("form")!);
    formData.set("test_email", testEmail);

    try {
      const result = await testSmtpAction(formData);
      setTestResult({ success: true, message: result.message });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={data.id} />
      {isSetup && <input type="hidden" name="setup" value="required" />}

      <div className="space-y-2">
        <Label htmlFor="name">Company Name</Label>
        <Input id="name" name="name" defaultValue={data.name || ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tel">Tel</Label>
        <Input id="tel" name="tel" defaultValue={data.tel || ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={3}
          defaultValue={data.address || ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">Contact Info</Label>
        <Input id="contact" name="contact" defaultValue={data.contact || ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prefix">Invoice Prefix</Label>
        <Input
          id="prefix"
          name="prefix"
          defaultValue={data.prefix || "INV-"}
          placeholder="INV-"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_currency">Default Currency</Label>
        <select
          id="default_currency"
          name="default_currency"
          defaultValue={data.default_currency || "HKD"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="HKD">HKD - Hong Kong Dollar</option>
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="JPY">JPY - Japanese Yen</option>
          <option value="CNY">CNY - Chinese Yuan</option>
          <option value="CAD">CAD - Canadian Dollar</option>
          <option value="AUD">AUD - Australian Dollar</option>
          <option value="SGD">SGD - Singapore Dollar</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_terms">Payment Terms</Label>
        <Textarea
          id="payment_terms"
          name="payment_terms"
          rows={3}
          defaultValue={data.payment_terms || ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account">Bank Account Details</Label>
        <Textarea
          id="bank_account"
          name="bank_account"
          rows={3}
          defaultValue={data.bank_account || ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input
          id="logo_url"
          name="logo_url"
          placeholder="https://example.com/logo.png"
          defaultValue={data.logo_url || ""}
        />
      </div>

      {/* SMTP Settings */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-medium mb-4">
          SMTP Settings for Invoice Emails
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp_host">SMTP Host</Label>
            <Input
              id="smtp_host"
              name="smtp_host"
              placeholder="smtp.gmail.com"
              defaultValue={data.smtp_host || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input
              id="smtp_port"
              name="smtp_port"
              type="number"
              placeholder="587"
              defaultValue={data.smtp_port ? String(data.smtp_port) : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_username">SMTP Username</Label>
            <Input
              id="smtp_username"
              name="smtp_username"
              placeholder="your-email@gmail.com"
              defaultValue={data.smtp_username || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_password">SMTP Password</Label>
            <Input
              id="smtp_password"
              name="smtp_password"
              type="password"
              placeholder="your-app-password"
              defaultValue={data.smtp_password || ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_secure">Security Protocol</Label>
            <select
              id="smtp_secure"
              name="smtp_secure"
              defaultValue={data.smtp_secure || "TLS"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="TLS">TLS (Recommended)</option>
              <option value="SSL">SSL</option>
              <option value="NONE">None</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp_sender">Sender Email Address (Optional)</Label>
            <Input
              id="smtp_sender"
              name="smtp_sender"
              type="email"
              placeholder="noreply@yourcompany.com"
              defaultValue={data.smtp_sender || ""}
            />
            <p className="text-xs text-muted-foreground">
              If left empty, will use SMTP username as sender address
            </p>
          </div>
        </div>

        {/* SMTP Test Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-md font-medium mb-4">Test SMTP Settings</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test_email">Test Recipient Email</Label>
              <Input
                id="test_email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSmtp}
              disabled={isTestingSmtp || !testEmail}
            >
              {isTestingSmtp ? "Testing..." : "Send Test Email"}
            </Button>
            {testResult && (
              <div
                className={`p-3 rounded-md text-sm ${
                  testResult.success
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="email_template">Email Template</Label>
          <Textarea
            id="email_template"
            name="email_template"
            rows={6}
            placeholder="Dear customer,&#10;&#10;Please find attached your invoice.&#10;&#10;Thank you for your business!&#10;&#10;Best regards,&#10;Your Company"
            defaultValue={
              data.email_template ||
              "Dear {customer_name},\n\nPlease find attached your invoice {invoice_number}.\n\nThank you for your business!\n\nBest regards,\n{company_name}"
            }
          />
          <p className="text-xs text-muted-foreground">
            Available placeholders: &#123;customer_name&#125;,
            &#123;invoice_number&#125;, &#123;company_name&#125;,
            &#123;total_amount&#125;, &#123;due_date&#125;
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Save Profile</Button>
      </div>

      {state && <FormMessage message={state} />}
    </form>
  );
}
