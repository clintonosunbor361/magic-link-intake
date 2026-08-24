"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClientResult = {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  latestOrderTitle: string | null;
};

export function ClientPicker({
  initialSelected = null,
  fieldName = "existingClientId",
  noResultsMessage = "No matching Clients. A new Client will be created.",
}: {
  initialSelected?: ClientResult | null;
  fieldName?: string;
  noResultsMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[] | null>(null);
  const [selected, setSelected] = useState<ClientResult | null>(initialSelected);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}`);
      const data = (await response.json()) as { clients?: ClientResult[] };
      setResults(data.clients ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={fieldName} value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex items-center justify-between rounded-[0.8rem] border border-[#afc67d] bg-[#eaf5cf] px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-[#4f6528]">{selected.fullName}</p>
            <p className="text-[#5a7030]">
              {selected.primaryPhone}
              {selected.email ? ` - ${selected.email}` : ""}
            </p>
            <p className="text-[#5a7030]">
              {selected.latestOrderTitle ? `Latest order: ${selected.latestOrderTitle}` : "No prior Orders"}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              aria-label="Search Clients"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search existing Clients by name or phone"
            />
            <Button type="button" variant="outline" onClick={search} disabled={searching} className="shrink-0">
              {searching ? "..." : "Search"}
            </Button>
          </div>
          {results && results.length ? (
            <ul className="divide-y divide-kuartz-line rounded-[0.8rem] border border-kuartz-line">
              {results.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(client)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-[#f8f8f4] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-kuartz-ink">{client.fullName}</span>
                    <span className="text-kuartz-secondary">
                      {client.primaryPhone}
                      {client.email ? ` - ${client.email}` : ""}
                      {client.latestOrderTitle ? ` - Latest: ${client.latestOrderTitle}` : " - No prior Orders"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : results ? (
            <p className="text-sm text-kuartz-secondary" role="status">
              {noResultsMessage}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
