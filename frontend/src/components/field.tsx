import type { ComponentProps, ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Common = {
  label: string
  /** mensagem vinda do 400 do DRF; quando presente, substitui a dica */
  error?: string
  hint?: ReactNode
}

function Wrapper({
  label,
  error,
  hint,
  id,
  children,
}: Common & { id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {/* erro é texto colorido: usa a rampa *-ink, que passa em AA (DESIGN.md) */}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}

export function Field({
  label,
  error,
  hint,
  id,
  ...props
}: Common & ComponentProps<"input">) {
  const fieldId = id ?? props.name ?? label
  return (
    <Wrapper label={label} error={error} hint={hint} id={fieldId}>
      <Input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
    </Wrapper>
  )
}

type Option = { value: string | number; label: string }

/**
 * `<select>` nativo com as classes do Input. Nativo é deliberado: no celular
 * abre o seletor do sistema, e é onde a venda é registrada.
 */
export function SelectField({
  label,
  error,
  hint,
  id,
  options,
  placeholder,
  className,
  ...props
}: Common & ComponentProps<"select"> & { options: Option[]; placeholder?: string }) {
  const fieldId = id ?? props.name ?? label
  return (
    <Wrapper label={label} error={error} hint={hint} id={fieldId}>
      <select
        id={fieldId}
        data-slot="input"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  )
}
