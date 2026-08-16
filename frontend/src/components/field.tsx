import { useId } from "react"
import type { ComponentProps, ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fromCents, money } from "@/lib/format"
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
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
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
  const autoId = useId()
  const fieldId = id ?? props.name ?? autoId
  return (
    <Wrapper label={label} error={error} hint={hint} id={fieldId}>
      <Input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [hint && !error ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...props}
      />
    </Wrapper>
  )
}

/** Centavos primeiro, da direita para a esquerda, como banco digital: cada
 *  dígito empurra o valor uma casa, e o apagar desfaz na mesma ordem. Quem usa
 *  digita "1250" e lê "R$ 12,50" — nunca precisa achar a vírgula.
 *
 *  Para fora o campo continua falando decimal-como-string ("12.50"), que é o
 *  que a API espera; a máscara não vaza para o estado do formulário.
 */
export function MoneyField({
  value,
  onValueChange,
  ...props
}: Common &
  Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
    value: string
    onValueChange: (value: string) => void
  }) {
  const caretToEnd = (input: HTMLInputElement) =>
    input.setSelectionRange(input.value.length, input.value.length)

  return (
    <Field
      {...props}
      type="text"
      // numeric e não decimal: no celular o teclado abre só com dígitos, já
      // que vírgula e ponto não têm mais função aqui
      inputMode="numeric"
      placeholder={props.placeholder ?? "R$ 0,00"}
      value={value === "" ? "" : money(value)}
      onChange={(event) => {
        const input = event.currentTarget
        const digits = input.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11)
        onValueChange(digits === "" ? "" : fromCents(Number(digits)))
        // o valor exibido muda de tamanho a cada dígito; sem isso o cursor
        // fica no meio da máscara e o próximo dígito entra no lugar errado
        requestAnimationFrame(() => caretToEnd(input))
      }}
      onFocus={(event) => caretToEnd(event.currentTarget)}
    />
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
  const autoId = useId()
  const fieldId = id ?? props.name ?? autoId
  return (
    <Wrapper label={label} error={error} hint={hint} id={fieldId}>
      <select
        id={fieldId}
        data-slot="input"
        aria-invalid={Boolean(error)}
        aria-describedby={
          [hint && !error ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
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
