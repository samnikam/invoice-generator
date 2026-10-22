"use client";

import { Plus, Trash2 } from "lucide-react";

import { AmountInput } from "@/components/forms/amount-input";
import { FormField } from "@/components/forms/form-field";
import { GstRateSelect } from "@/components/forms/tax-selects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { TREATMENT_OPTIONS } from "@/lib/calculators/gst-calculator";
import type { DocumentTotals } from "@/lib/documents/calculate-totals";
import {
  fieldDomId,
  type DiscountChoice,
  type InvoiceLineValues,
} from "@/lib/invoices/invoice-form";
import { formatPaise } from "@/lib/money/format";

type LineField = keyof Omit<InvoiceLineValues, "id">;

export function LineItemsEditor({
  lines,
  isTaxInvoice,
  totals,
  errorFor,
  onChange,
  onTouch,
  onAdd,
  onRemove,
}: {
  lines: InvoiceLineValues[];
  isTaxInvoice: boolean;
  totals: DocumentTotals | null;
  errorFor: (field: string) => string | undefined;
  onChange: (id: string, patch: Partial<InvoiceLineValues>) => void;
  onTouch: (field: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {lines.map((line, index) => {
          const key = (name: LineField) => `lines.${line.id}.${name}`;
          const id = (name: LineField) => fieldDomId(key(name));
          const err = (name: LineField) => errorFor(key(name));
          const lineTotal = totals?.lines[index]?.totalPaise;
          const label = `Item ${index + 1}`;

          return (
            <li key={line.id}>
              <div
                role="group"
                aria-labelledby={`${id("description")}-heading`}
                className="space-y-4 rounded-lg border bg-background p-4"
                data-testid="line-item"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 id={`${id("description")}-heading`} className="text-sm font-semibold">
                    {label}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(line.id)}
                    disabled={lines.length === 1}
                    aria-label={`Remove ${label.toLowerCase()}`}
                    title={lines.length === 1 ? "An invoice needs at least one item" : undefined}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                </div>

                <FormField id={id("description")} label="Description" error={err("description")}>
                  {(control) => (
                    <Textarea
                      {...control}
                      rows={2}
                      placeholder="Product or service"
                      value={line.description}
                      onChange={(e) => onChange(line.id, { description: e.target.value })}
                      onBlur={() => onTouch(key("description"))}
                    />
                  )}
                </FormField>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id={id("quantity")} label="Quantity" error={err("quantity")}>
                    {(control) => (
                      <Input
                        {...control}
                        inputMode="decimal"
                        autoComplete="off"
                        className="h-10 tabular-nums"
                        value={line.quantity}
                        onChange={(e) => onChange(line.id, { quantity: e.target.value })}
                        onBlur={() => onTouch(key("quantity"))}
                      />
                    )}
                  </FormField>
                  <FormField id={id("unitPrice")} label="Unit price" error={err("unitPrice")}>
                    {(control) => (
                      <AmountInput
                        {...control}
                        unit="₹"
                        placeholder="0.00"
                        value={line.unitPrice}
                        onChange={(e) => onChange(line.id, { unitPrice: e.target.value })}
                        onBlur={() => onTouch(key("unitPrice"))}
                      />
                    )}
                  </FormField>
                  <FormField id={id("hsnSac")} label="HSN/SAC" optional error={err("hsnSac")}>
                    {(control) => (
                      <Input
                        {...control}
                        inputMode="numeric"
                        autoComplete="off"
                        className="h-10 tabular-nums"
                        placeholder="e.g. 998314"
                        value={line.hsnSac}
                        onChange={(e) => onChange(line.id, { hsnSac: e.target.value })}
                        onBlur={() => onTouch(key("hsnSac"))}
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id={id("discountKind")} label="Discount">
                    {(control) => (
                      <NativeSelect
                        {...control}
                        value={line.discountKind}
                        onChange={(e) =>
                          onChange(line.id, {
                            discountKind: e.target.value as DiscountChoice,
                            discountValue: "",
                          })
                        }
                      >
                        <option value="none">No discount</option>
                        <option value="percent">Percentage (%)</option>
                        <option value="amount">Fixed amount (₹)</option>
                      </NativeSelect>
                    )}
                  </FormField>
                  {line.discountKind !== "none" ? (
                    <FormField
                      id={id("discountValue")}
                      label={line.discountKind === "percent" ? "Discount %" : "Discount amount"}
                      error={err("discountValue")}
                    >
                      {(control) => (
                        <AmountInput
                          {...control}
                          unit={line.discountKind === "percent" ? "%" : "₹"}
                          value={line.discountValue}
                          onChange={(e) => onChange(line.id, { discountValue: e.target.value })}
                          onBlur={() => onTouch(key("discountValue"))}
                        />
                      )}
                    </FormField>
                  ) : null}
                </div>

                {isTaxInvoice ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id={id("treatment")}
                      label="GST treatment"
                      hint={TREATMENT_OPTIONS.find((o) => o.value === line.treatment)?.hint}
                      error={err("treatment")}
                    >
                      {(control) => (
                        <NativeSelect
                          {...control}
                          value={line.treatment}
                          onChange={(e) => {
                            onChange(line.id, {
                              treatment: e.target.value as InvoiceLineValues["treatment"],
                            });
                            onTouch(key("treatment"));
                          }}
                        >
                          <option value="">Select treatment</option>
                          {TREATMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                    {line.treatment === "taxable" ? (
                      <FormField id={id("rateId")} label="GST rate" error={err("rateId")}>
                        {(control) => (
                          <GstRateSelect
                            {...control}
                            value={line.rateId}
                            onChange={(value) => {
                              onChange(line.id, { rateId: value });
                              onTouch(key("rateId"));
                            }}
                          />
                        )}
                      </FormField>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-right text-sm text-muted-foreground" aria-live="polite">
                  Line total:{" "}
                  <span
                    className="font-semibold text-foreground tabular-nums"
                    data-testid="line-total"
                  >
                    {lineTotal !== undefined ? formatPaise(lineTotal) : "—"}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="outline" onClick={onAdd}>
        <Plus data-icon="inline-start" />
        Add item
      </Button>
    </div>
  );
}
