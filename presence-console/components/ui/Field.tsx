import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-faint focus:border-red focus:outline-none focus:ring-3 focus:ring-red/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint aria-invalid:border-danger aria-invalid:ring-danger/15";

export function Field({
  label,
  name,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={name} className="font-ui text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="text-red" aria-hidden> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-[12.5px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Err = { error?: string };

export function Input({ className, error, name, ...props }: ComponentProps<"input"> & Err) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "h-10", className)}
      {...props}
    />
  );
}

export function Textarea({ className, error, name, ...props }: ComponentProps<"textarea"> & Err) {
  return (
    <textarea
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, error, name, children, ...props }: ComponentProps<"select"> & Err) {
  return (
    <select
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={cn(control, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%238a9099%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_10px_center] bg-no-repeat pr-9", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, description, name, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  const id = props.id ?? `${name}-${String(props.value ?? "on")}`;
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg py-1", className)}>
      <input
        id={id}
        name={name}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-[#e31e24]"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {description ? <span className="mt-0.5 block text-[12.5px] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Grille de formulaire responsive. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>;
}
