"use client";

import { useState } from "react";
import { History, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDisplayDate } from "@/lib/dates";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import { listHistory } from "@/lib/history/history-storage";
import {
  pastCustomersFromHistory,
  searchPastCustomers,
  type PastCustomer,
} from "@/lib/history/past-customers";

type Loaded =
  { state: "idle" } | { state: "unavailable" } | { state: "loaded"; customers: PastCustomer[] };

/**
 * "Find a past customer": searches customers in documents saved to History in this
 * browser (read-only, nothing online). The form changes only when the user presses
 * "Use customer" on a result. History is (re)read when the search box gets focus, so a
 * document saved a moment ago is included.
 */
export function PastCustomerFinder({
  documentNoun,
  onSelect,
}: {
  documentNoun: string;
  /** Fills the form; returns false if the user cancelled (the search then stays open). */
  onSelect: (customer: PastCustomer) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<Loaded>({ state: "idle" });

  function load() {
    const list = listHistory(getBrowserStorage());
    setLoaded(
      list.status === "loaded"
        ? { state: "loaded", customers: pastCustomersFromHistory(list.records) }
        : { state: "unavailable" },
    );
  }

  const results = loaded.state === "loaded" ? searchPastCustomers(loaded.customers, query) : [];
  const searching = query.trim() !== "";

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3.5 print:hidden"
      data-testid="past-customer-finder"
    >
      <div className="space-y-2">
        <Label htmlFor="past-customer-search">Find a past customer</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="past-customer-search"
            type="search"
            autoComplete="off"
            placeholder="Name or mobile number"
            className="pl-9"
            value={query}
            aria-describedby="past-customer-hint"
            onFocus={load}
            onChange={(e) => {
              if (loaded.state === "idle") load();
              setQuery(e.target.value);
            }}
          />
        </div>
        <p
          id="past-customer-hint"
          className="flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          <History aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Searches only documents saved to History in this browser. Nothing is looked up online, and
          the {documentNoun} changes only when you choose a customer.
        </p>
      </div>

      <div aria-live="polite">
        {!searching ? null : loaded.state === "unavailable" ? (
          <p className="text-sm text-destructive" data-testid="past-customer-message">
            Saved documents can’t be read because this browser is not allowing access to its
            storage.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="past-customer-message">
            {loaded.state === "loaded" && loaded.customers.length === 0
              ? "No saved customers yet. Customers appear here after you use “Save to history”."
              : "No past customer matches this search."}
          </p>
        ) : (
          <ul
            aria-label="Matching past customers"
            className="divide-y overflow-hidden rounded-lg border bg-card"
          >
            {results.map((customer) => (
              <li
                key={customer.key}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid="past-customer-result"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{customer.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs break-words text-muted-foreground">
                    {[
                      customer.gstin ? `GSTIN ${customer.gstin}` : null,
                      customer.phone || null,
                      customer.address ? customer.address.replace(/\s*\n\s*/g, ", ") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No other details saved"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last: {customer.latest.kind} {customer.latest.documentNumber},{" "}
                    {formatDisplayDate(customer.latest.date)}
                    {customer.documentCount > 1
                      ? ` · ${customer.documentCount} saved documents`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-center"
                  aria-label={`Use customer: ${customer.name}`}
                  onClick={() => {
                    if (onSelect(customer)) setQuery("");
                  }}
                >
                  Use customer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
