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
      <div className="mt-4 space-y-5">
        {looks.map((look, index) => (
          <fieldset key={look.id} className="rounded-[1.15rem] border border-kuartz-control bg-white/72 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <legend className="text-base font-extrabold text-kuartz-ink">Look {index + 1}</legend>
              {looks.length > 1 ? (
                <Button type="button" variant="ghost" onClick={() => removeLook(look.id)} className="text-kuartz-secondary hover:text-red-700">
                  <Trash2 size={16} aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-4">
              <label className="form-group">
                <span>Look name</span>
                <Input name="lookName" required />
              </label>
              <label className="form-group">
                <span>
                  Look date <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <Input name="lookDate" type="date" />
              </label>
              <label className="form-group">
                <span>
                  Notes <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <Input name="lookNotes" />
              </label>
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
