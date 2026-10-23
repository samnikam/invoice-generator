import type { ReactNode } from "react";

import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Labelled single-line or multi-line text field with hint and error, built on FormField. */
export function TextField({
  id,
  label,
  value,
  onValueChange,
  onBlur,
  error,
  hint,
  optional,
  multiline = false,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  multiline?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} optional={optional} hint={hint} error={error}>
      {(control) =>
        multiline ? (
          <Textarea
            {...control}
            rows={2}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={onBlur}
          />
        ) : (
          <Input
            {...control}
            type={type}
            inputMode={inputMode}
            className="h-10"
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={onBlur}
          />
        )
      }
    </FormField>
  );
}
