"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFieldError } from "./ActionForm";
import { Field, Input, Select, Textarea } from "./Field";

/** Champs reliés aux erreurs de validation de l'<ActionForm> parent. */
type Common = { label: string; name: string; hint?: ReactNode; required?: boolean; className?: string };

export function TextField({ label, name, hint, required, className, ...props }: Common & Omit<ComponentProps<"input">, "name">) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} className={className}>
      <Input name={name} error={error} required={required} {...props} />
    </Field>
  );
}

export function TextAreaField({ label, name, hint, required, className, ...props }: Common & Omit<ComponentProps<"textarea">, "name">) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} className={className}>
      <Textarea name={name} error={error} required={required} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  hint,
  required,
  className,
  options,
  ...props
}: Common & Omit<ComponentProps<"select">, "name"> & { options: Array<{ value: string; label: string; disabled?: boolean }> }) {
  const error = useFieldError(name);
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} className={className}>
      <Select name={name} error={error} required={required} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="text-[12.5px] text-danger">{error}</p> : null;
}
