import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

/** Labelled input used across the auth forms. */
export function Field({ label, name, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-xs font-semibold text-ink-2"
      >
        {label}
      </label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
