import { apiFetch } from "@/lib/api"
import type { ChannelFeeTier } from "@/lib/channels"
import { percentToFraction } from "@/lib/format"

// os dois únicos valores que services/pricing.py::margin_status devolve; o
// primeiro é o único que pinta de vermelho (margem abaixo da meta do produto).
export type MarginStatus = "abaixo da meta" | "na meta ou acima"
export const BELOW_TARGET: MarginStatus = "abaixo da meta"

/** Corpo exato aceito pelo SimulateInputSerializer (price decimal-string > 0). */
export type SimulateInput = {
  product: number
  channel: number
  price: string
  freight?: string | null
}

/** Saída do simulate: TUDO string. margin_pct é FRAÇÃO ("0.3200" = 32%). */
export type SimulateResult = {
  cogs: string
  fee: string
  freight: string
  profit: string
  margin_pct: string
  status: MarginStatus
}

/** Campos do form (strings de <input>). */
export type SimulateForm = {
  product: string
  channel: string
  price: string
  freight: string
}

/**
 * Monta o corpo a partir do form. Devolve null enquanto faltar produto, canal
 * ou um preço > 0 — nada a simular ainda. Frete vazio é omitido: o backend cai
 * no padrão do canal.
 */
export function buildInput(form: SimulateForm): SimulateInput | null {
  if (!form.product || !form.channel) return null
  if (!(Number(form.price) > 0)) return null
  const input: SimulateInput = {
    product: Number(form.product),
    channel: Number(form.channel),
    price: form.price,
  }
  if (form.freight.trim() !== "") input.freight = form.freight
  return input
}

export const simulate = (input: SimulateInput) =>
  apiFetch<SimulateResult>("/api/pricing/simulate/", {
    method: "POST",
    body: JSON.stringify(input),
  })

/** Corpo aceito pelo TargetPriceInputSerializer (margin é fração, 0 a 0.99). */
export type TargetPriceInput = {
  product: number
  channel: number
  margin: string
  freight?: string | null
}

/**
 * Saída do target-price. `price` é null quando a margem é inatingível no canal.
 * `warnings` já chega em português do backend — inclui o aviso de zona morta,
 * que é o motivo desta tela existir (spec da 2c-2, critério de pronto).
 */
export type TargetPriceResult = {
  price: string | null
  tier: ChannelFeeTier | null
  warnings: string[]
}

/** Campos do modo "preço para a margem-alvo" (margem em % na tela). */
export type TargetForm = {
  product: string
  channel: string
  margin: string
  freight: string
}

/**
 * Monta o corpo do target-price. Devolve null enquanto faltar produto, canal ou
 * uma margem utilizável. O serializer aceita fração de 0 a 0.99, então a tela
 * para em 99%: 100% seria preço infinito.
 */
export function buildTargetInput(form: TargetForm): TargetPriceInput | null {
  if (!form.product || !form.channel) return null
  if (form.margin.trim() === "") return null
  const margin = Number(form.margin)
  if (!Number.isFinite(margin) || margin < 0 || margin > 99) return null
  const input: TargetPriceInput = {
    product: Number(form.product),
    channel: Number(form.channel),
    margin: percentToFraction(form.margin),
  }
  if (form.freight.trim() !== "") input.freight = form.freight
  return input
}

export const targetPrice = (input: TargetPriceInput) =>
  apiFetch<TargetPriceResult>("/api/pricing/target-price/", {
    method: "POST",
    body: JSON.stringify(input),
  })
