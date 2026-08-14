"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

function grouped(value: string): string {
  const normalized = value.replaceAll(",", "").trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return value;
  const [whole, fraction] = normalized.split(".");
  const formatted = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Number(whole));
  return fraction === undefined ? formatted : `${formatted}.${fraction}`;
}

export function MoneyInput({ defaultValue, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [value, setValue] = React.useState(defaultValue == null ? "" : String(defaultValue));
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onFocus={() => setValue((current) => current.replaceAll(",", ""))}
      onBlur={() => setValue((current) => grouped(current))}
    />
  );
}
