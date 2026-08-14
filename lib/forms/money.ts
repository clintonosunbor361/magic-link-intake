export function parseMoneyToMinorUnits(raw: string): number {
  const value = raw.trim();
  if (!/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(value) && !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }
  const normalized = value.replaceAll(",", "");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
}

export function formatMinorUnits(value: number): string {
  return formatMinorUnitsLocale(value);
}

export function formatMinorUnitsLocale(value: number, locale = "en-NG"): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100);
}
