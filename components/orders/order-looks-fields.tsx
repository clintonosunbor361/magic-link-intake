"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LookField = {
  id: number;
};

export function OrderLooksFields() {
  const [looks, setLooks] = useState<LookField[]>([{ id: 1 }]);

  function addLook() {
    setLooks((current) => [...current, { id: Date.now() }]);
  }

  function removeLook(id: number) {
    setLooks((current) => current.filter((look) => look.id !== id));
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Looks</h2>
        <Button type="button" variant="outline" onClick={addLook}>
          <Plus size={16} aria-hidden="true" />
          Add look
        </Button>
      </div>
      <p className="mt-1 text-sm leading-6 text-kuartz-secondary">
        Add the Look names now. Items, dates, and notes can be filled in after the Order is created.
      </p>
      <div className="mt-4 space-y-3">
        {looks.map((look, index) => (
          <fieldset key={look.id} className="rounded-[1rem] border border-kuartz-control bg-white/72 p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="form-group">
                <span>Look {index + 1} name</span>
                <Input name="lookName" required placeholder={index === 0 ? "Traditional Wedding" : "Reception Look"} />
              </label>
              {looks.length > 1 ? (
                <Button type="button" variant="ghost" onClick={() => removeLook(look.id)} className="sm:mb-0 text-kuartz-secondary hover:text-red-700">
                  <Trash2 size={16} aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
