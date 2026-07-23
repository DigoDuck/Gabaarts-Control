import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import { fractionToPercent, percentToFraction } from "@/lib/format"
import {
  createChannel,
  getChannel,
  updateChannel,
  type ChannelPayload,
} from "@/lib/channels"

// estado do formulário: tudo string, como sai de <input>. commission_pct fica
// em percentual (12) na tela; vira fração de 4 casas (0.1200) só no toPayload().
// uid é só da tela: identidade estável da linha para o React, já que faixa nova
// ainda não tem id do backend e remover pelo índice embaralharia as linhas
type TierForm = {
  uid: string
  min_price: string
  commission_pct: string
  fixed_fee: string
}

type FormState = {
  name: string
  slug: string
  default_freight: string
  fee_tiers: TierForm[]
}

const EMPTY: FormState = { name: "", slug: "", default_freight: "", fee_tiers: [] }

// nova faixa começa como base (a partir de R$ 0), o resto a usuária preenche
const newTier = (): TierForm => ({
  uid: crypto.randomUUID(),
  min_price: "0",
  commission_pct: "",
  fixed_fee: "0",
})

function toPayload(form: FormState): ChannelPayload {
  return {
    name: form.name,
    slug: form.slug,
    default_freight: form.default_freight || null,
    fee_tiers: form.fee_tiers.map((tier) => ({
      min_price: tier.min_price || "0",
      commission_pct: percentToFraction(tier.commission_pct),
      fixed_fee: tier.fixed_fee || "0",
    })),
  }
}

export function ChannelForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // enquanto o GET não volta, o form ainda mostra os vazios de EMPTY. Salvar
  // aqui apagaria TODAS as faixas do canal: o PUT escreve por substituição.
  const [loading, setLoading] = useState(editing)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const setTier = (index: number, patch: Partial<TierForm>) =>
    setForm((current) => ({
      ...current,
      fee_tiers: current.fee_tiers.map((tier, position) =>
        position === index ? { ...tier, ...patch } : tier,
      ),
    }))

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    setLoading(true)
    getChannel(Number(id))
      .then((channel) =>
        setForm({
          name: channel.name,
          slug: channel.slug,
          default_freight: channel.default_freight ?? "",
          fee_tiers: channel.fee_tiers.map((tier) => ({
            uid: crypto.randomUUID(),
            min_price: tier.min_price,
            commission_pct: fractionToPercent(tier.commission_pct),
            fixed_fee: tier.fixed_fee,
          })),
        }),
      )
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [editing, id])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (editing && loadError) {
        // salvar sobre um formulário que não carregou apagaria as faixas do canal
        setErrors({ detail: ["Este canal não foi carregado. Recarregue a página."] })
        return
      }
      setSaving(true)
      setErrors({})
      try {
        const payload = toPayload(form)
        if (editing) await updateChannel(Number(id), payload)
        else await createChannel(payload)
        navigate("/channels")
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
    <form onSubmit={submit} className="grid max-w-3xl gap-6">
      {loadError && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          Não foi possível carregar este canal. Volte à lista e tente de novo.
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
          label="Nome"
          name="name"
          required
          value={form.name}
          error={fieldError(errors, "name")}
          onChange={(event) => set("name", event.target.value)}
        />
        <Field
          label="Slug"
          name="slug"
          required
          hint="Identificador curto e único, tipo 'shopee'."
          value={form.slug}
          error={fieldError(errors, "slug")}
          onChange={(event) => set("slug", event.target.value)}
        />
      </div>

      <Field
        label="Frete padrão (R$)"
        name="default_freight"
        type="number"
        step="0.01"
        min="0"
        hint="Opcional: frete usado quando o item não informa o seu."
        value={form.default_freight}
        error={fieldError(errors, "default_freight")}
        onChange={(event) => set("default_freight", event.target.value)}
      />

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm text-muted-foreground">Faixas de taxa</legend>

        {form.fee_tiers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sem faixas: este canal usa só o frete padrão, sem comissão.
          </p>
        )}

        {form.fee_tiers.map((tier, index) => (
          <div key={tier.uid} className="grid gap-2 sm:grid-cols-[8rem_8rem_8rem_auto]">
            <Field
              label="A partir de (R$)"
              type="number"
              step="0.01"
              min="0"
              value={tier.min_price}
              onChange={(event) => setTier(index, { min_price: event.target.value })}
            />
            <Field
              label="Comissão (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              // sem required, faixa em branco salva 0% em silêncio e toda venda
              // futura no canal congela unit_fee subestimado
              required
              value={tier.commission_pct}
              onChange={(event) => setTier(index, { commission_pct: event.target.value })}
            />
            <Field
              label="Taxa fixa (R$)"
              type="number"
              step="0.01"
              min="0"
              value={tier.fixed_fee}
              onChange={(event) => setTier(index, { fixed_fee: event.target.value })}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  set(
                    "fee_tiers",
                    form.fee_tiers.filter((_, position) => position !== index),
                  )
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
          onClick={() => set("fee_tiers", [...form.fee_tiers, newTier()])}
        >
          Adicionar faixa
        </Button>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || loading}>
          {saving ? "Salvando…" : loading ? "Carregando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/channels")}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
