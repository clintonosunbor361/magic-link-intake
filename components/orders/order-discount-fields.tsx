"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/ui/money-input";

export function OrderDiscountFields() {
  const [ffDiscount, setFfDiscount] = useState(false);

  return (
    <div className="space-y-4">
      <label className="checkbox-field">
        <input
          type="checkbox"
          name="ffDiscount"
          className="h-5 w-5"
          checked={ffDiscount}
          onChange={(event) => setFfDiscount(event.target.checked)}
        />
        Friends &amp; Family discount
      </label>

      {ffDiscount ? (
        <label className="form-group">
          <span>
            Amount discounted (NGN) <span className="font-normal text-kuartz-secondary">(optional)</span>
          </span>
          <MoneyInput name="ffDiscountAmount" />
        </label>
      ) : null}
    </div>
  );
}
