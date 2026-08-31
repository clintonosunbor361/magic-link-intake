"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMinorUnits } from "@/lib/forms/money";

type InvoiceLineInput = {
  id?: string;
  description: string;
  quantity: number | string;
  unitPriceMinor?: number;
  unitPrice?: string;
};

type EditableLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function createBlankLine(): EditableLine {
  return {
    key: `blank-${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "",
    unitPrice: "",
  };
}

function toEditableLine(line: InvoiceLineInput, index: number): EditableLine {
  return {
    key: line.id ?? `line-${index}`,
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: line.unitPrice ?? formatMinorUnits(line.unitPriceMinor ?? 0),
  };
}

export function InvoiceLineItemsFields({ lines }: { lines: InvoiceLineInput[] }) {
  const [rows, setRows] = useState<EditableLine[]>(() => {
    if (lines.length) return lines.map(toEditableLine);
    return [{ key: "blank-0", description: "", quantity: "", unitPrice: "" }];
  });

  function addRow() {
    setRows((current) => [...current, createBlankLine()]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  return (
    <fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <legend className="text-sm font-semibold text-kuartz-body">Line items</legend>
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add line item
        </Button>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_8rem_auto]">
            <label className="form-group">
              <span className="sr-only">Description</span>
              <Input name="lineDescription" defaultValue={row.description} placeholder="Description" />
            </label>
            <label className="form-group">
              <span className="sr-only">Quantity</span>
              <Input name="lineQuantity" defaultValue={row.quantity} placeholder="Qty" inputMode="numeric" />
            </label>
            <label className="form-group">
              <span className="sr-only">Unit price</span>
              <MoneyInput name="lineUnitPrice" defaultValue={row.unitPrice} placeholder="Unit price (NGN)" />
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeRow(row.key)}
              disabled={rows.length === 1}
              className="self-end sm:h-12 sm:w-12 sm:px-0"
              aria-label={`Remove line item ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="sm:sr-only">Remove</span>
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
