import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field, SelectField } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import { fractionToPercent, money, percentToFraction } from "@/lib/format"
import { listMakers, type Maker } from "@/lib/makers"
import {
  CATEGORY_OPTIONS,
  createProduct,
  getProduct,
  listProducts,
  previewProduct,
  updateProduct,
  type ComboItem,
  type CostPreview,
  type Product,
  type ProductPayload,
} from "@/lib/products"

// estado do formulário: tudo string, como sai de <input>. A conversão para o
// formato do domínio acontece uma vez, em toPayload().
type FormState = {
  name: string
  category: string
  is_active: boolean
  material_cost: string
  packaging_cost: string
  waste_pct: string
  production_time_min: string
  batch_size: string
  maker: string
  target_margin_pct: string
  base_price: string
  is_combo: boolean
  combo_items: ComboItem[]
}

const EMPTY: FormState = {
  name: "",
  category: "other",
  is_active: true,
  material_cost: "0",
  packaging_cost: "0",
  waste_pct: "0",
  production_time_min: "0",
  batch_size: "1",
  maker: "",
  target_margin_pct: "50",
  base_price: "",
  is_combo: false,
  combo_items: [],
}

function toPayload(form: FormState): ProductPayload {
  return {
    name: form.name,
    category: form.category as ProductPayload["category"],
    is_active: form.is_active,
    is_combo: form.is_combo,
    material_cost: form.material_cost || "0",
    packaging_cost: form.packaging_cost || "0",
    waste_pct: percentToFraction(form.waste_pct),
    production_time_min: Number(form.production_time_min || 0),
    batch_size: Number(form.batch_size || 1),
    maker: form.maker ? Number(form.maker) : null,
    target_margin_pct: percentToFraction(form.target_margin_pct),
    base_price: form.base_price || null,
    // desmarcar "é kit" com componentes na tela não pode enviá-los mesmo assim
    combo_items: form.is_combo ? form.combo_items : [],
  }
}

export function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [form, setForm] = useState<FormState>(EMPTY)
  const [makers, setMakers] = useState<Maker[]>([])
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [stale, setStale] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // enquanto o GET não volta, o form ainda mostra os vazios de EMPTY; salvar
  // aqui gravaria vazio por cima do dado real, porque o PUT escreve tudo
  const [loading, setLoading] = useState(editing)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    listMakers().then(setMakers).catch(() => setMakers([]))
  }, [])

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    setLoading(true)
    getProduct(Number(id))
      .then((product) =>
        setForm({
          name: product.name,
          category: product.category,
          is_active: product.is_active,
          material_cost: product.material_cost,
          packaging_cost: product.packaging_cost,
          waste_pct: fractionToPercent(product.waste_pct),
          production_time_min: String(product.production_time_min),
          batch_size: String(product.batch_size),
          maker: product.maker ? String(product.maker) : "",
          target_margin_pct: fractionToPercent(product.target_margin_pct),
          base_price: product.base_price ?? "",
          is_combo: product.is_combo,
          combo_items: product.combo_items,
        }),
      )
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [editing, id])

  const [components, setComponents] = useState<Product[]>([])

  useEffect(() => {
    // kit dentro de kit é bloqueado no backend; nem oferecer na lista
    listProducts()
      .then((all) =>
        setComponents(
          all.filter((item) => !item.is_combo && String(item.id) !== id),
        ),
      )
      .catch(() => setComponents([]))
  }, [id])

  // preview com debounce: enquanto a resposta não chega os números anteriores
  // ficam esmaecidos, para o painel não piscar a cada tecla.
  // `dropped` descarta resposta fora de ordem: uma requisição lenta disparada
  // antes não pode sobrescrever o resultado de uma rápida disparada depois.
  useEffect(() => {
    let dropped = false
    setStale(true)
    const timer = setTimeout(() => {
      previewProduct(toPayload(form))
        .then((result) => {
          if (dropped) return
          setPreview(result)
          setStale(false)
        })
        .catch(() => {
          if (!dropped) setStale(false)
        })
    }, 400)
    return () => {
      dropped = true
      clearTimeout(timer)
    }
  }, [form])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (editing && loadError) {
        // salvar sobre um formulário que não carregou zeraria os custos do produto
        setErrors({ detail: ["Este produto não foi carregado. Recarregue a página."] })
        return
      }
      setSaving(true)
      setErrors({})
      try {
        const payload = toPayload(form)
        if (editing) await updateProduct(Number(id), payload)
        else await createProduct(payload)
        navigate("/products")
      } catch (error) {
        if (error instanceof ApiError) setErrors(error.fields)
        else setErrors({ non_field_errors: ["Não foi possível salvar."] })
      } finally {
        setSaving(false)
      }
    },
    [editing, form, id, loadError, navigate],
  )

  const resumo = summaryErrors(errors)

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="grid gap-4 content-start">
        {loadError && (
          <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
            Não foi possível carregar este produto. Volte à lista e tente de novo.
          </p>
        )}

        {resumo.length > 0 && (
          <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
            {resumo.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
        )}

        <Field
          label="Nome"
          name="name"
          required
          value={form.name}
          error={fieldError(errors, "name")}
          onChange={(event) => set("name", event.target.value)}
        />

        <SelectField
          label="Categoria"
          name="category"
          value={form.category}
          options={CATEGORY_OPTIONS}
          error={fieldError(errors, "category")}
          onChange={(event) => set("category", event.target.value)}
        />

        <Field
          label="Material por unidade (R$)"
          name="material_cost"
          type="number"
          step="0.01"
          min="0"
          hint="Custo do insumo de UMA peça, não do lote."
          value={form.material_cost}
          error={fieldError(errors, "material_cost")}
          onChange={(event) => set("material_cost", event.target.value)}
        />

        <Field
          label="Embalagem por unidade (R$)"
          name="packaging_cost"
          type="number"
          step="0.01"
          min="0"
          value={form.packaging_cost}
          error={fieldError(errors, "packaging_cost")}
          onChange={(event) => set("packaging_cost", event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tempo por lote (min)"
            name="production_time_min"
            type="number"
            min="0"
            hint="Tempo de UMA pessoa para produzir o lote inteiro."
            value={form.production_time_min}
            error={fieldError(errors, "production_time_min")}
            onChange={(event) => set("production_time_min", event.target.value)}
          />
          <Field
            label="Peças por lote"
            name="batch_size"
            type="number"
            min="1"
            value={form.batch_size}
            error={fieldError(errors, "batch_size")}
            onChange={(event) => set("batch_size", event.target.value)}
          />
        </div>

        <SelectField
          label="Quem faz"
          name="maker"
          value={form.maker}
          placeholder="Ninguém (produto sem mão de obra)"
          options={makers.map((maker) => ({ value: maker.id, label: maker.name }))}
          error={fieldError(errors, "maker")}
          onChange={(event) => set("maker", event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Perda sobre o material (%)"
            name="waste_pct"
            type="number"
            step="0.01"
            min="0"
            value={form.waste_pct}
            error={fieldError(errors, "waste_pct")}
            onChange={(event) => set("waste_pct", event.target.value)}
          />
          <Field
            label="Margem-alvo (%)"
            name="target_margin_pct"
            type="number"
            step="0.01"
            min="0"
            max="99"
            value={form.target_margin_pct}
            error={fieldError(errors, "target_margin_pct")}
            onChange={(event) => set("target_margin_pct", event.target.value)}
          />
        </div>

        <Field
          label="Preço praticado (R$)"
          name="base_price"
          type="number"
          step="0.01"
          min="0"
          hint="Opcional: o preço que você cobra hoje."
          value={form.base_price}
          error={fieldError(errors, "base_price")}
          onChange={(event) => set("base_price", event.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={(event) => set("is_active", event.target.checked)}
          />
          Produto ativo
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_combo}
            onChange={(event) => set("is_combo", event.target.checked)}
          />
          É um kit (soma o custo dos componentes)
        </label>

        {fieldError(errors, "is_combo") && (
          <p className="text-xs text-danger-ink">{fieldError(errors, "is_combo")}</p>
        )}

        {form.is_combo && (
          <fieldset className="grid gap-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm text-muted-foreground">Componentes</legend>

            {form.combo_items.length < 2 && (
              <p className="text-sm text-muted-foreground">
                Um kit precisa de pelo menos dois componentes.
              </p>
            )}

            {form.combo_items.map((item, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <SelectField
                    label="Produto"
                    value={String(item.component)}
                    placeholder="Escolha um produto"
                    options={components.map((product) => ({
                      value: product.id,
                      label: product.name,
                    }))}
                    onChange={(event) =>
                      set(
                        "combo_items",
                        form.combo_items.map((current, position) =>
                          position === index
                            ? { ...current, component: Number(event.target.value) }
                            : current,
                        ),
                      )
                    }
                  />
                </div>
                <div className="w-24">
                  <Field
                    label="Qtd"
                    type="number"
                    min="1"
                    value={String(item.qty)}
                    onChange={(event) =>
                      set(
                        "combo_items",
                        form.combo_items.map((current, position) =>
                          position === index
                            ? { ...current, qty: Number(event.target.value || 1) }
                            : current,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    set(
                      "combo_items",
                      form.combo_items.filter((_, position) => position !== index),
                    )
                  }
                >
                  Remover
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              disabled={components.length === 0}
              onClick={() =>
                set("combo_items", [
                  ...form.combo_items,
                  { component: components[0].id, qty: 1 },
                ])
              }
            >
              Adicionar componente
            </Button>
          </fieldset>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Salvando…" : loading ? "Carregando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/products")}>
            Cancelar
          </Button>
        </div>
      </div>

      <aside
        className={`h-fit rounded-lg border border-border bg-surface p-4 transition-opacity ${
          stale ? "opacity-50" : "opacity-100"
        }`}
      >
        <h2 className="font-display text-sm tracking-wide uppercase">Cálculo</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <Row label="Material" value={preview?.cogs.material} />
          <Row label="Mão de obra" value={preview?.cogs.labor} />
          <Row label="Embalagem" value={preview?.cogs.packaging} />
          <div className="mt-1 border-t border-border pt-2">
            <Row label="Custo unitário" value={preview?.cogs.total} strong />
          </div>
          <Row label="Preço sugerido" value={preview?.suggested_price} strong />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Preço sugerido é para venda direta: não desconta taxa de marketplace nem
          frete.
        </p>
      </aside>
    </form>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      {/* dado é neutro: valor nunca recebe cor de marca (DESIGN.md, regra dura 2) */}
      <dd className={`tabular-nums ${strong ? "font-medium" : "text-muted-foreground"}`}>
        {value ? money(value) : "—"}
      </dd>
    </div>
  )
}
