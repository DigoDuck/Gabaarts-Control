import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field, SelectField } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import { money } from "@/lib/format"
import { listChannels, type Channel } from "@/lib/channels"
import { listProducts, type Product } from "@/lib/products"
import {
  createSale,
  getSale,
  STATUS_OPTIONS,
  updateSale,
  type Sale,
  type SaleItem,
  type SalePayload,
  type SaleStatus,
} from "@/lib/sales"

type ItemForm = { product: string; qty: string; unit_price: string; unit_freight: string }

const EMPTY_ITEM: ItemForm = { product: "", qty: "1", unit_price: "", unit_freight: "" }

/**
 * Produto inativo não pode ser vendido, mas venda antiga pode ter um: mantém o
 * produto da própria linha na lista para o select não aparecer vazio.
 */
function productOptions(all: Product[], selected: string) {
  return all
    .filter((product) => product.is_active || String(product.id) === selected)
    .map((product) => ({
      value: product.id,
      label: product.is_active ? product.name : `${product.name} (inativo)`,
    }))
}

/** Frete comparável: null e "" são "não informado"; "0.00" e "0" são o mesmo zero. */
function freightOf(item: SaleItem) {
  return item.unit_freight === null || item.unit_freight === "" ? null : Number(item.unit_freight)
}

/**
 * Itens mudaram? Compara só o que a usuária digita; unit_cogs/unit_fee são
 * congelados pelo backend e não entram na comparação. Preço e frete comparam
 * numericamente porque "40.00" (API) e "40" (input) são o mesmo preço.
 */
function itemsChanged(original: SaleItem[], current: SaleItem[]) {
  if (original.length !== current.length) return true
  return original.some((item, index) => {
    const now = current[index]
    return (
      item.product !== now.product ||
      item.qty !== now.qty ||
      Number(item.unit_price) !== Number(now.unit_price) ||
      freightOf(item) !== freightOf(now)
    )
  })
}

/**
 * Só os campos que mudaram. Mandar `items` intocado faria o backend apagar e
 * recriar as linhas, e linha nova é re-precificada com os parâmetros de hoje —
 * o que reescreveria o lucro de uma venda antiga.
 */
function changedFields(original: Sale, payload: SalePayload): Partial<SalePayload> {
  const patch: Partial<SalePayload> = {}
  if (payload.date !== original.date) patch.date = payload.date
  if (payload.channel !== original.channel) patch.channel = payload.channel
  if (payload.customer_name !== original.customer_name)
    patch.customer_name = payload.customer_name
  if (payload.status !== original.status) patch.status = payload.status
  if (itemsChanged(original.items, payload.items)) patch.items = payload.items
  return patch
}

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [date, setDate] = useState("")
  const [channel, setChannel] = useState("")
  const [customer, setCustomer] = useState("")
  const [status, setStatus] = useState<SaleStatus>("completed")
  const [items, setItems] = useState<ItemForm[]>([EMPTY_ITEM])
  const [channels, setChannels] = useState<Channel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saved, setSaved] = useState<Sale | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    listChannels().then(setChannels).catch(() => setChannels([]))
    listProducts()
      .then(setProducts)
      .catch(() => {
        setProducts([])
        setLoadError(true)
      })
  }, [])

  useEffect(() => {
    if (!editing) return
    getSale(Number(id))
      .then((sale) => {
        setDate(sale.date)
        setChannel(String(sale.channel))
        setCustomer(sale.customer_name)
        setStatus(sale.status)
        setSaved(sale)
        setItems(
          sale.items.map((item) => ({
            product: String(item.product),
            qty: String(item.qty),
            unit_price: item.unit_price,
            unit_freight: item.unit_freight ?? "",
          })),
        )
      })
      .catch(() => setLoadError(true))
  }, [editing, id])

  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    )

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (editing && loadError) {
        setErrors({ detail: ["Esta venda não foi carregada. Recarregue a página."] })
        return
      }
      if (editing && !saved) {
        // sem a venda carregada não há como saber o que mudou, e cair no create
        // criaria uma venda nova sem a usuária perceber
        setErrors({
          detail: ["Esta venda ainda não terminou de carregar. Aguarde um instante e tente de novo."],
        })
        return
      }
      setSaving(true)
      setErrors({})
      const payload: SalePayload = {
        date,
        channel: Number(channel),
        customer_name: customer,
        status,
        items: items
          .filter((item) => item.product)
          .map<SaleItem>((item) => ({
            product: Number(item.product),
            qty: Number(item.qty || 1),
            unit_price: item.unit_price || "0",
            unit_freight: item.unit_freight || null,
          })),
      }
      if (payload.items.length === 0) {
        // venda sem item é R$ 0,00 no histórico e a API aceita: barrar aqui
        setErrors({ items: ["Adicione ao menos um item à venda."] })
        setSaving(false)
        return
      }
      try {
        if (editing && saved) {
          const patch = changedFields(saved, payload)
          // nada mudou: não gastar request nem arriscar tocar no snapshot
          if (Object.keys(patch).length > 0) {
            setSaved(await updateSale(Number(id), patch))
          }
        } else {
          setSaved(await createSale(payload))
        }
        navigate("/sales")
      } catch (error) {
        if (error instanceof ApiError) setErrors(error.fields)
        else setErrors({ non_field_errors: ["Não foi possível salvar."] })
      } finally {
        setSaving(false)
      }
    },
    [channel, customer, date, editing, id, items, loadError, navigate, saved, status],
  )

  const resumo = summaryErrors(errors)

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-6">
      {loadError && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          Não foi possível carregar esta venda. Volte à lista e tente de novo.
        </p>
      )}

      {editing && (
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          Alterar canal, itens, preço ou frete recalcula o custo e a taxa desta venda
          com os parâmetros de hoje. Corrigir cliente, data ou situação não mexe nos
          valores congelados.
        </p>
      )}

      {resumo.length > 0 && (
        <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          {resumo.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Data"
          name="date"
          type="date"
          required
          value={date}
          error={fieldError(errors, "date")}
          onChange={(event) => setDate(event.target.value)}
        />
        <SelectField
          label="Canal"
          name="channel"
          required
          value={channel}
          placeholder="Escolha o canal"
          options={channels.map((item) => ({ value: item.id, label: item.name }))}
          error={fieldError(errors, "channel")}
          onChange={(event) => setChannel(event.target.value)}
        />
        <Field
          label="Cliente"
          name="customer_name"
          hint="Opcional."
          value={customer}
          error={fieldError(errors, "customer_name")}
          onChange={(event) => setCustomer(event.target.value)}
        />
        <SelectField
          label="Situação"
          name="status"
          value={status}
          options={STATUS_OPTIONS}
          error={fieldError(errors, "status")}
          onChange={(event) => setStatus(event.target.value as SaleStatus)}
        />
      </div>

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm text-muted-foreground">Itens</legend>

        {fieldError(errors, "items") && (
          <p className="text-xs text-danger-ink">{fieldError(errors, "items")}</p>
        )}

        {items.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_7rem_auto]">
            <SelectField
              label="Produto"
              required
              value={item.product}
              placeholder="Escolha um produto"
              options={productOptions(products, item.product)}
              onChange={(event) => setItem(index, { product: event.target.value })}
            />
            <Field
              label="Qtd"
              type="number"
              min="1"
              value={item.qty}
              onChange={(event) => setItem(index, { qty: event.target.value })}
            />
            <Field
              label="Preço (R$)"
              type="number"
              step="0.01"
              min="0.01"
              value={item.unit_price}
              onChange={(event) => setItem(index, { unit_price: event.target.value })}
            />
            <Field
              label="Frete (R$)"
              type="number"
              step="0.01"
              min="0"
              hint="Vazio usa o padrão do canal."
              value={item.unit_freight}
              onChange={(event) => setItem(index, { unit_freight: event.target.value })}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                disabled={items.length === 1}
                onClick={() =>
                  setItems(items.filter((_, position) => position !== index))
                }
              >
                Remover
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => setItems([...items, EMPTY_ITEM])}
        >
          Adicionar item
        </Button>
      </fieldset>

      {saved && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-sm tracking-wide uppercase">
            Resultado congelado
          </h2>
          <dl className="mt-3 grid gap-2 text-sm">
            {saved.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {item.qty}× {item.product_name}
                </dt>
                <dd className="tabular-nums text-muted-foreground">
                  custo {money(item.unit_cogs ?? "0")} · taxa {money(item.unit_fee ?? "0")}{" "}
                  · lucro {money(item.unit_profit ?? "0")}
                </dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2">
              <dt>Total</dt>
              <dd className="font-medium tabular-nums">{money(saved.total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Lucro</dt>
              <dd
                className={`font-medium tabular-nums ${
                  Number(saved.profit) < 0 ? "text-danger-ink" : ""
                }`}
              >
                {money(saved.profit)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/sales")}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
