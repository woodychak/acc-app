"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Star, Pencil } from "lucide-react";
import {
  addCurrencyAction,
  removeCurrencyAction,
  setDefaultCurrencyAction,
  updateCurrencyBalanceAction,
} from "@/app/dashboard/currencies/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// World currencies list
const WORLD_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn" },
  { code: "ISK", name: "Icelandic Krona", symbol: "kr" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "QAR", name: "Qatari Riyal", symbol: "﷼" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "OMR", name: "Omani Rial", symbol: "﷼" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { code: "LBP", name: "Lebanese Pound", symbol: "£" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج" },
  { code: "LYD", name: "Libyan Dinar", symbol: "ل.د" },
  { code: "SDG", name: "Sudanese Pound", symbol: "ج.س." },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "RWF", name: "Rwandan Franc", symbol: "RF" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "₨" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "BWP", name: "Botswanan Pula", symbol: "P" },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "L" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj" },
  { code: "SOS", name: "Somali Shilling", symbol: "S" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "$" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
  { code: "LRD", name: "Liberian Dollar", symbol: "L$" },
  { code: "SLE", name: "Sierra Leonean Leone", symbol: "Le" },
  { code: "STN", name: "São Tomé and Príncipe Dobra", symbol: "Db" },
];

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_default: boolean;
  is_active: boolean;
  start_balance?: number;
};

type CurrencyManagementProps = {
  currencies: Currency[];
};

export function CurrencyManagement({ currencies }: CurrencyManagementProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [startBalance, setStartBalance] = useState("");
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const handleAddCurrency = async (formData: FormData) => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const selectedCurrencyData = WORLD_CURRENCIES.find(c => c.code === selectedCurrency);
    
    if (!selectedCurrencyData) {
      setError("Please select a currency");
      setIsSubmitting(false);
      return;
    }

    // Check if currency already exists
    const existingCurrency = currencies.find(c => c.code === selectedCurrencyData.code);
    if (existingCurrency) {
      setError("Currency already exists in your profile");
      setIsSubmitting(false);
      return;
    }

    // Create form data with selected currency
    const currencyFormData = new FormData();
    currencyFormData.append("code", selectedCurrencyData.code);
    currencyFormData.append("name", selectedCurrencyData.name);
    currencyFormData.append("symbol", selectedCurrencyData.symbol);
    currencyFormData.append("start_balance", startBalance || "0");

    const result = await addCurrencyAction(currencyFormData);
    
    if (result?.type === "error") {
      setError(result.message);
    } else if (result?.type === "success") {
      setSuccess(result.message);
      setShowAddForm(false);
      setSelectedCurrency("");
      setStartBalance("");
    }

    setIsSubmitting(false);
  };

  const handleEditBalance = async (currencyId: string) => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("currency_id", currencyId);
    formData.append("start_balance", editBalance);

    const result = await updateCurrencyBalanceAction(formData);
    
    if (result?.type === "error") {
      setError(result.message);
    } else if (result?.type === "success") {
      setSuccess(result.message);
      setEditingCurrencyId(null);
      setEditBalance("");
    }

    setIsSubmitting(false);
  };

  // Get available currencies (not already added)
  const availableCurrencies = WORLD_CURRENCIES.filter(
    worldCurrency => !currencies.some(userCurrency => userCurrency.code === worldCurrency.code)
  );

  const handleRemoveCurrency = async (currencyId: string) => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("currencyId", currencyId);

    const result = await removeCurrencyAction(formData);

    if (result?.type === "error") {
      setError(result.message);
    } else if (result?.type === "success") {
      setSuccess(result.message);
    }

    setIsSubmitting(false);
  };

  const handleSetDefault = async (currencyId: string) => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("currencyId", currencyId);

    const result = await setDefaultCurrencyAction(formData);

    if (result?.type === "error") {
      setError(result.message);
    } else if (result?.type === "success") {
      setSuccess(result.message);
    }

    setIsSubmitting(false);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Currency Management
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="sm"
            variant="outline"
            disabled={availableCurrencies.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Currency
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {showAddForm && (
          <form
            id="add-currency-form"
            action={handleAddCurrency}
            className="border rounded-lg p-4 bg-gray-50 space-y-4"
          >
            <div>
              <Label htmlFor="currency-select">Select Currency *</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a currency to add" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{currency.code}</span>
                        <span className="text-sm text-gray-600">{currency.symbol}</span>
                        <span className="text-sm">{currency.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableCurrencies.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  All available currencies have been added to your profile.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="start_balance">Start Balance</Label>
              <Input
                id="start_balance"
                name="start_balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Initial balance for this currency (optional)
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting || !selectedCurrency} size="sm">
                {isSubmitting ? "Adding..." : "Add Currency"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedCurrency("");
                  setStartBalance("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {currencies.map((currency) => (
            <div
              key={currency.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{currency.code}</span>
                  <span className="text-sm text-gray-600">{currency.symbol}</span>
                  {currency.is_default && (
                    <Badge variant="default" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-gray-700">{currency.name}</span>
                {editingCurrencyId === currency.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="w-32"
                    />
                    <Button
                      onClick={() => handleEditBalance(currency.id)}
                      size="sm"
                      disabled={isSubmitting}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingCurrencyId(null);
                        setEditBalance("");
                      }}
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Balance: {currency.symbol}{(currency.start_balance || 0).toFixed(2)}
                    </span>
                    <Button
                      onClick={() => {
                        setEditingCurrencyId(currency.id);
                        setEditBalance((currency.start_balance || 0).toString());
                      }}
                      size="sm"
                      variant="ghost"
                      disabled={isSubmitting}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!currency.is_default && (
                  <Button
                    onClick={() => handleSetDefault(currency.id)}
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                  >
                    Set Default
                  </Button>
                )}
                {!currency.is_default && (
                  <Button
                    onClick={() => handleRemoveCurrency(currency.id)}
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {currencies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No currencies found. Add your first currency above.
          </div>
        )}
      </CardContent>
    </Card>
  );
}