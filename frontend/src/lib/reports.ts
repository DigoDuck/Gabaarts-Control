import { apiFetch } from "@/lib/api"

export type ChannelBreakdown = {
  channel: number
  channel_name: string
  revenue: string
  profit: string
}

export type Summary = {
  revenue: string
  profit: string
  sales_count: number
  avg_ticket: string
  by_channel: ChannelBreakdown[]
}

// data local em AAAA-MM-DD; toISOString() usa UTC e pularia o dia perto da virada
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`

/** Período padrão do dashboard: 1º dia do mês corrente até hoje. */
export function monthToDate(now = new Date()) {
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(now),
  }
}

/**
 * from e to são obrigatórios juntos neste endpoint (diferente de /sales, onde
 * cada um filtra sozinho). channel é opcional.
 */
export function getSummary(params: { from: string; to: string; channel?: string }) {
  const query = new URLSearchParams({ from: params.from, to: params.to })
  if (params.channel) query.set("channel", params.channel)
  return apiFetch<Summary>(`/api/reports/summary/?${query}`)
}

/** Largura da barra em %, proporcional ao maior valor; 0 quando não há base. */
export function barPercent(value: string, max: number) {
  if (max <= 0) return 0
  return Math.max(0, (Number(value) / max) * 100)
}
