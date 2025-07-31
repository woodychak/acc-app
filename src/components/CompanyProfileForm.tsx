"use client";

import { useFormState } from "react-dom";
import { updateCompanyProfileAction } from "@/app/dashboard/company-profile/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";

export function CompanyProfileForm({
  data,
  isSetup,
}: {
  data: any;
  isSetup: boolean;
}) {
  const [state, formAction] = useFormState(updateCompanyProfileAction, null);

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
        <Input
          id="contact"
          name="contact"
          defaultValue={data.contact || ""}
        />
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

        {/* ✅ Logo URL 欄位 */}
      <Input
        name="logo_url"
        placeholder="https://example.com/logo.png"
        defaultValue={data.logo_url || ""}
      />

      </div>

      <div className="flex justify-end">
        <Button type="submit">Save Profile</Button>
      </div>

      {state && <FormMessage message={state} />}
    </form>

    
  );
}