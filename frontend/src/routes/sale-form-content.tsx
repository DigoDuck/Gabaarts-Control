import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field, SelectField } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import { listChannels, type Channel } from "@/lib/channels"
import { money, percent } from "@/lib/format"
import { listProducts, type Product } from "@/lib/products"
import {
  createSale,
  getSale,
  previewSale,
  STATUS_OPTIONS,
  updateSale,
  type Sale,
  type SaleFinancialDraft,
  type SaleItem,
  type SalePayload,
  type SaleResult,
  type SaleStatus,
} from "@/lib/sales"
import { selectProduct, type ItemForm } from "@/routes/sale-form-state"

const emptyItem = (): ItemForm => ({ product: "", qty: "1" })

function productOptions(all: Product[], selected: string) {
  return all
    .filter((product) => product.is_active || String(product.id) === selected)
    .map((product) => ({
      value: product.id,
      label: product.is_active ? product.name : `${product.name} (inativo)`,
    }))
}

function normalizedItems(items: ItemForm[]): SaleItem[] {
  return items
    .filter((item) => item.product)
    .map((item) => ({ product: Number(item.product), qty: Number(item.qty || 0) }))
}

function financialDraft(
  channel: string,
  productsTotal: string,
  shippingAmount: string,
  manualFee: boolean,
  feeOverride: string,
  items: ItemForm[],
): SaleFinancialDraft {
  return {
    channel: Number(channel),
    products_total: productsTotal,
    shipping_amount: shippingAmount || "0",
    ...(manualFee && { fee_override: feeOverride }),
    items: normalizedItems(items),
  }
}

const numeric = (value: string | null | undefined) => Number(value || 0)
const itemSignature = (items: SaleItem[]) => items.map(({ product, qty }) => [product, qty])

function calculationKey(draft: SaleFinancialDraft) {
  return JSON.stringify({
    channel: draft.channel,
    products_total: numeric(draft.products_total),
    fee_override:
      draft.fee_override === undefined ? undefined : numeric(draft.fee_override),
    items: itemSignature(draft.items),
  })
}

function resultKey(draft: SaleFinancialDraft) {
  return JSON.stringify({
    calculation: calculationKey(draft),
    shipping_amount: numeric(draft.shipping_amount),
  })
}

function validDraft(draft: SaleFinancialDraft) {
  return (
    draft.channel > 0 &&
    numeric(draft.products_total) > 0 &&
    numeric(draft.shipping_amount) >= 0 &&
    (draft.fee_override === undefined ||
      (draft.fee_override !== "" && numeric(draft.fee_override) >= 0)) &&
    draft.items.length > 0 &&
    draft.items.every((item) => item.product > 0 && item.qty >= 1)
  )
}

function frozenResult(sale: Sale, shipping = sale.shipping_amount): SaleResult {
  return {
    total_cogs: sale.total_cogs,
    suggested_channel_fee: sale.channel_fee,
    applied_channel_fee: sale.channel_fee,
    fee_source: sale.fee_source,
    profit: sale.profit,
    margin_pct: sale.margin_pct,
    target_margin_pct: "0.0000",
    amount_paid: (numeric(sale.products_total) + numeric(shipping)).toFixed(2),
    warnings: [],
  }
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [date, setDate] = useState("")
  const [channel, setChannel] = useState("")
  const [customer, setCustomer] = useState("")
  const [status, setStatus] = useState<SaleStatus>("completed")
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])
  const [productsTotal, setProductsTotal] = useState("")
  const [shippingAmount, setShippingAmount] = useState("0")
  const [manualFee, setManualFee] = useState(false)
  const [feeOverride, setFeeOverride] = useState("")
  const [channels, setChannels] = useState<Channel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saved, setSaved] = useState<Sale | null>(null)
  const [baselineKey, setBaselineKey] = useState<string | null>(null)
  const [baselineCalculation, setBaselineCalculation] = useState<string | null>(null)
  const [preview, setPreview] = useState<SaleResult | null>(null)
  const [previewedKey, setPreviewedKey] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState("")
  const [stale, setStale] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(editing)

  useEffect(() => {
    Promise.all([listChannels(), listProducts()])
      .then(([availableChannels, availableProducts]) => {
        setChannels(availableChannels)
        setProducts(availableProducts)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    getSale(Number(id))
      .then((sale) => {
        const loadedItems = sale.items.map((item) => ({
          product: String(item.product),
          qty: String(item.qty),
        }))
        const isManual = sale.fee_source === "manual"
        const loadedDraft = financialDraft(
          String(sale.channel),
          sale.products_total,
          sale.shipping_amount,
          isManual,
          isManual ? sale.channel_fee : "",
          loadedItems,
        )
        setDate(sale.date)
        setChannel(String(sale.channel))
        setCustomer(sale.customer_name)
        setStatus(sale.status)
        setItems(loadedItems)
        setProductsTotal(sale.products_total)
        setShippingAmount(sale.shipping_amount)
        setManualFee(isManual)
        setFeeOverride(isManual ? sale.channel_fee : "")
        setSaved(sale)
        setBaselineKey(resultKey(loadedDraft))
        setBaselineCalculation(calculationKey(loadedDraft))
        setPreview(frozenResult(sale))
        setPreviewedKey(resultKey(loadedDraft))
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [editing, id])

  const draft = useMemo(
    () => financialDraft(
      channel, productsTotal, shippingAmount, manualFee, feeOverride, items,
    ),
    [channel, feeOverride, items, manualFee, productsTotal, shippingAmount],
  )
  const currentKey = resultKey(draft)
  const currentCalculation = calculationKey(draft)
  const frozen = Boolean(editing && saved && currentKey === baselineKey)

  useEffect(() => {
    let dropped = false
    if (!validDraft(draft)) {
      setPreview(null)
      setPreviewedKey(null)
      setPreviewError("")
      setStale(false)
      return
    }
    if (editing && saved && currentKey === baselineKey) {
      setPreview(frozenResult(saved))
      setPreviewedKey(currentKey)
      setPreviewError("")
      setStale(false)
      return
    }
    // Frete é só repasse. Numa venda antiga, alterá-lo não recalcula o snapshot.
    if (editing && saved && currentCalculation === baselineCalculation) {
      setPreview(frozenResult(saved, draft.shipping_amount))
      setPreviewedKey(currentKey)
      setPreviewError("")
      setStale(false)
      return
    }

    setStale(true)
    setPreviewError("")
    const timer = setTimeout(() => {
      previewSale(draft)
        .then((result) => {
          if (dropped) return
          setPreview(result)
          setPreviewedKey(currentKey)
          setStale(false)
        })
        .catch(() => {
          if (dropped) return
          setPreviewedKey(null)
          setPreviewError("Não foi possível atualizar o cálculo. Confira os dados e tente de novo.")
          setStale(false)
        })
    }, 400)
    return () => {
      dropped = true
      clearTimeout(timer)
    }
  }, [baselineCalculation, baselineKey, currentCalculation, currentKey, draft, editing, saved])

  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setItems((current) => current.map((item, position) =>
      position === index ? { ...item, ...patch } : item,
    ))

  const snapshotChanged = Boolean(
    editing && baselineCalculation && currentCalculation !== baselineCalculation,
  )
  const shippingChanged = Boolean(
    editing && saved && numeric(shippingAmount) !== numeric(saved.shipping_amount),
  )
  const canSave =
    !saving && !loading && !loadError && validDraft(draft) && previewedKey === currentKey

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave || !preview) {
      setErrors({ detail: ["Aguarde o cálculo atualizado antes de salvar."] })
      return
    }
    if (editing && !saved) {
      setErrors({ detail: ["Esta venda ainda não terminou de carregar."] })
      return
    }
    if (
      snapshotChanged &&
      !window.confirm("Os valores congelados desta venda serão substituídos. Salvar novo resultado?")
    ) return

    setSaving(true)
    setErrors({})
    const payload: SalePayload = {
      date,
      customer_name: customer,
      status,
      ...draft,
    }
    try {
      if (editing && saved) {
        const patch: Partial<SalePayload> = {}
        if (date !== saved.date) patch.date = date
        if (customer !== saved.customer_name) patch.customer_name = customer
        if (status !== saved.status) patch.status = status
        if (snapshotChanged) {
          patch.channel = draft.channel
          patch.products_total = draft.products_total
          patch.shipping_amount = draft.shipping_amount
          patch.items = draft.items
          patch.fee_override = manualFee ? feeOverride : null
        } else if (shippingChanged) {
          patch.shipping_amount = draft.shipping_amount
        }
        if (Object.keys(patch).length > 0) await updateSale(Number(id), patch)
      } else {
        await createSale(payload)
      }
      navigate("/sales")
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields)
      else setErrors({ non_field_errors: ["Não foi possível salvar a venda."] })
    } finally {
      setSaving(false)
    }
  }, [canSave, customer, date, draft, editing, feeOverride, id, manualFee, navigate, preview, saved, shippingChanged, snapshotChanged, status])

  const resumo = summaryErrors(errors)

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid content-start gap-6">
        {loadError && <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">Não foi possível carregar os dados necessários. Recarregue a página.</p>}
        {editing && <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">Data, cliente e situação preservam o resultado. Alterar canal, produtos, total ou taxa cria um novo resultado congelado.</p>}
        {resumo.length > 0 && <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">{resumo.map((message, index) => <p key={index}>{message}</p>)}</div>}

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-sm tracking-wide uppercase">Dados da venda</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" name="date" type="date" required value={date} error={fieldError(errors, "date")} onChange={(event) => setDate(event.target.value)} />
            <SelectField label="Canal" name="channel" required value={channel} placeholder="Escolha o canal" options={channels.map((item) => ({ value: item.id, label: item.name }))} error={fieldError(errors, "channel")} onChange={(event) => setChannel(event.target.value)} />
            <Field label="Cliente" name="customer_name" hint="Opcional." value={customer} error={fieldError(errors, "customer_name")} onChange={(event) => setCustomer(event.target.value)} />
            <SelectField label="Situação" name="status" value={status} options={STATUS_OPTIONS} error={fieldError(errors, "status")} onChange={(event) => setStatus(event.target.value as SaleStatus)} />
          </div>
        </section>

        <fieldset className="grid gap-4 rounded-lg border border-border p-4">
          <legend className="px-1 font-display text-sm tracking-wide uppercase">Produtos</legend>
          <p className="text-sm text-muted-foreground">Informe o que foi vendido e a quantidade. O preço entra uma vez, no total do pedido.</p>
          {fieldError(errors, "items") && <p className="text-xs text-danger-ink">{fieldError(errors, "items")}</p>}
          {items.map((item, index) => {
            const selected = products.find((product) => String(product.id) === item.product)
            const estimatedCost = selected ? Number(selected.cogs.total) * Math.max(1, Number(item.qty || 1)) : null
            return (
              <div key={index} className="grid gap-3 rounded-md bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_5rem_auto] sm:items-end">
                <SelectField label="Produto" required value={item.product} placeholder="Escolha um produto" options={productOptions(products, item.product)} onChange={(event) => setItems((current) => selectProduct(current, index, event.target.value))} />
                <Field label="Qtd" type="number" min="1" value={item.qty} onChange={(event) => setItem(index, { qty: event.target.value })} />
                <Button type="button" variant="outline" className="min-h-11" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Remover</Button>
                <p className="text-xs text-muted-foreground sm:col-span-3">{estimatedCost === null ? "Selecione o produto para ver o custo estimado." : `Custo estimado destes itens: ${money(estimatedCost.toFixed(2))}`}</p>
              </div>
            )
          })}
          <Button type="button" variant="outline" className="min-h-11 justify-self-start" onClick={() => setItems((current) => [...current, emptyItem()])}>Adicionar produto</Button>
        </fieldset>

        <section className="grid gap-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="font-display text-sm tracking-wide uppercase">Valores do pedido</h2>
            <p className="mt-1 text-sm text-muted-foreground">O total é o valor combinado de todos os produtos, sem o frete.</p>
          </div>
          <Field label="Total dos produtos (R$)" name="products_total" type="number" inputMode="decimal" step="0.01" min="0.01" required value={productsTotal} error={fieldError(errors, "products_total")} onChange={(event) => setProductsTotal(event.target.value)} />
          <Field label="Frete cobrado do cliente (R$)" name="shipping_amount" type="number" inputMode="decimal" step="0.01" min="0" value={shippingAmount} hint="Fica separado e não aumenta nem reduz o lucro dos produtos." error={fieldError(errors, "shipping_amount")} onChange={(event) => setShippingAmount(event.target.value)} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={manualFee} onChange={(event) => { setManualFee(event.target.checked); if (!event.target.checked) setFeeOverride("") }} />
            Informar a taxa real cobrada pela plataforma
          </label>
          {manualFee && <Field label="Taxa total da plataforma (R$)" name="fee_override" type="number" inputMode="decimal" step="0.01" min="0" required value={feeOverride} hint="Use o valor total exibido no pedido da plataforma." error={fieldError(errors, "fee_override")} onChange={(event) => setFeeOverride(event.target.value)} />}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={!canSave}>{saving ? "Salvando…" : snapshotChanged ? "Salvar novo resultado" : "Salvar venda"}</Button>
          <Button type="button" size="lg" variant="outline" onClick={() => navigate("/sales")}>Cancelar</Button>
        </div>
      </div>

      <aside className="h-fit lg:sticky lg:top-6">
        <div className="brand-gradient rounded-lg p-px">
          <div className={`rounded-[7px] bg-surface p-5 transition-opacity ${stale ? "opacity-50" : "opacity-100"}`} aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm tracking-wide uppercase">{frozen ? "Resultado congelado" : "Custo estimado"}</h2>
              {stale && <span className="text-xs text-muted-foreground">Atualizando…</span>}
            </div>
            {previewError && <p className="mt-4 text-sm text-danger-ink">{previewError}</p>}
            <dl className="mt-4 grid gap-3 text-sm">
              <ResultRow label="Total dos produtos" value={preview ? productsTotal : undefined} />
              <ResultRow label="Custo de produção" value={preview?.total_cogs} />
              <ResultRow label="Taxa sugerida" value={preview?.suggested_channel_fee} />
              {preview?.fee_source === "manual" && <ResultRow label="Taxa aplicada" value={preview.applied_channel_fee} />}
              <div className="border-t border-border pt-3"><ResultRow label="Lucro total" value={preview?.profit} strong danger={Boolean(preview && Number(preview.profit) < 0)} /></div>
              <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Margem</dt><dd className="font-medium tabular-nums">{preview ? percent(preview.margin_pct) : "—"}</dd></div>
              <ResultRow label="Frete" value={preview ? shippingAmount || "0" : undefined} />
              <ResultRow label="Total pago" value={preview?.amount_paid} strong />
            </dl>
            {preview?.warnings.length ? <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground">{preview.warnings.map((warning) => <li key={warning}>Atenção: {warning}</li>)}</ul> : null}
            {!preview && !previewError && <p className="mt-4 text-sm text-muted-foreground">Preencha canal, produtos e total para calcular.</p>}
          </div>
        </div>
      </aside>
    </form>
  )
}

function ResultRow({ label, value, strong = false, danger = false }: {
  label: string
  value?: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${strong ? "font-semibold" : "text-muted-foreground"} ${danger ? "text-danger-ink" : ""} tabular-nums`}>{value === undefined ? "—" : money(value)}</dd>
    </div>
  )
}
