export function parseMoneyToMinorUnits(raw: string): number {
  const value = raw.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a valid amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
}

export function formatMinorUnits(value: number): string {
  return (value / 100).toFixed(2);
}
