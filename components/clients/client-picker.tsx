"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  required = false,
}: {
  initialSelected?: ClientResult | null;
  fieldName?: string;
  noResultsMessage?: string;
  required?: boolean;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[] | null>(null);
  const [selected, setSelected] = useState<ClientResult | null>(initialSelected);
  const [searching, setSearching] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!required) return;
    const form = pickerRef.current?.closest("form");
    if (!form) return;

    function validateSelection(event: SubmitEvent) {
      if (selected) return;
      event.preventDefault();
      setSelectionError("Select a Client before creating an Order.");
      searchInputRef.current?.focus();
    }

    form.addEventListener("submit", validateSelection);
    return () => form.removeEventListener("submit", validateSelection);
  }, [required, selected]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (selected) return;
    if (trimmedQuery.length < 2) {
      setResults([]);
      setHasMore(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/clients/search?q=${encodeURIComponent(trimmedQuery)}&limit=5`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { clients?: ClientResult[]; hasMore?: boolean };
        setResults(data.clients ?? []);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setHasMore(false);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  async function showMoreResults() {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(trimmedQuery)}&limit=20`);
      const data = (await response.json()) as { clients?: ClientResult[]; hasMore?: boolean };
      setResults(data.clients ?? []);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div ref={pickerRef} className="space-y-3">
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-kuartz-muted" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              aria-label="Search Clients"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectionError("");
              }}
              placeholder="Search existing Clients by name, phone, or email"
              className="pl-11"
            />
          </div>
          {query.trim().length === 1 ? (
            <p className="text-sm text-kuartz-secondary">Type at least 2 characters to search.</p>
          ) : null}
          {searching ? <p className="text-sm text-kuartz-secondary" role="status">Searching Clients...</p> : null}
          {results && results.length ? (
            <ul className="divide-y divide-kuartz-line rounded-[0.8rem] border border-kuartz-line">
              {results.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(client);
                      setSelectionError("");
                    }}
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
              {hasMore ? (
                <li>
                  <button
                    type="button"
                    onClick={showMoreResults}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-kuartz-ink hover:bg-[#f8f8f4]"
                    disabled={searching}
                  >
                    View more results
                  </button>
                </li>
              ) : null}
            </ul>
          ) : results && query.trim().length >= 2 && !searching ? (
            <p className="text-sm text-kuartz-secondary" role="status">
              {noResultsMessage}
            </p>
          ) : null}
          {selectionError ? <p className="text-sm font-semibold text-red-700" role="alert">{selectionError}</p> : null}
        </>
      )}
    </div>
  );
}
