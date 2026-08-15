import { Prisma } from "@prisma/client";

export type InvoiceMathItem = {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  sortOrder?: number;
};

export type CalculatedInvoice = {
  items: Array<{ description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; amount: Prisma.Decimal; sortOrder: number }>;
  subtotal: Prisma.Decimal;
  discountRate: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function currencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 0 : 2;
}

function decimal(value: string | number, label: string): Prisma.Decimal {
  const normalized = typeof value === "number" ? String(value) : value.trim();
  if (!normalized || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) throw new Error(`${label} must be a valid decimal.`);
  const parsed = new Prisma.Decimal(normalized);
  if (!parsed.isFinite()) throw new Error(`${label} must be a finite decimal.`);
  return parsed;
}

function rounded(value: Prisma.Decimal, currency: string): Prisma.Decimal {
  return value.toDecimalPlaces(currencyFractionDigits(currency), Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateInvoice(items: InvoiceMathItem[], taxRateValue: string | number, currency: string, discountRateValue: string | number = 0): CalculatedInvoice {
  if (!items.length) throw new Error("An invoice needs at least one line item.");
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error("Invoice currency must be a three-letter code.");
  const taxRate = decimal(taxRateValue, "Tax rate").toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (taxRate.isNegative() || taxRate.gt(100)) throw new Error("Tax rate must be between 0 and 100.");
  const discountRate = decimal(discountRateValue, "Discount rate").toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (discountRate.isNegative() || discountRate.gt(100)) throw new Error("Discount rate must be between 0 and 100.");

  const normalizedItems = items.map((item, index) => {
    const description = item.description.trim().slice(0, 240);
    if (!description) throw new Error(`Line item ${index + 1} needs a description.`);
    const quantity = decimal(item.quantity, `Line item ${index + 1} quantity`).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const unitPrice = decimal(item.unitPrice, `Line item ${index + 1} rate`).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (quantity.lte(0) || quantity.gt(1_000_000)) throw new Error(`Line item ${index + 1} needs a positive quantity.`);
    if (unitPrice.isNegative() || unitPrice.gt(1_000_000_000)) throw new Error(`Line item ${index + 1} has an invalid rate.`);
    const amount = rounded(quantity.mul(unitPrice), normalizedCurrency);
    if (amount.gt(1_000_000_000)) throw new Error(`Line item ${index + 1} exceeds the supported amount.`);
    return {
      description,
      quantity,
      unitPrice,
      amount,
      sortOrder: item.sortOrder ?? index,
    };
  });

  const subtotal = rounded(normalizedItems.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)), normalizedCurrency);
  if (subtotal.lte(0)) throw new Error("Invoice subtotal must be greater than zero.");
  if (subtotal.gt("9999999999.99")) throw new Error("Invoice subtotal exceeds the supported amount.");
  const discountAmount = rounded(subtotal.mul(discountRate).div(100), normalizedCurrency);
  const taxableSubtotal = rounded(subtotal.sub(discountAmount), normalizedCurrency);
  const taxAmount = rounded(taxableSubtotal.mul(taxRate).div(100), normalizedCurrency);
  const total = rounded(taxableSubtotal.add(taxAmount), normalizedCurrency);
  if (total.gt("9999999999.99")) throw new Error("Invoice total exceeds the supported amount.");
  return { items: normalizedItems, subtotal, discountRate, discountAmount, taxRate, taxAmount, total };
}

export function decimalString(value: Prisma.Decimal | string | number, currency = "USD"): string {
  return rounded(value instanceof Prisma.Decimal ? value : decimal(value, "Amount"), currency).toFixed(currencyFractionDigits(currency));
}
