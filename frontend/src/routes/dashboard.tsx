import { useCallback, useEffect, useState } from "react"

import { Flame } from "@/components/brand"
import { Field, SelectField } from "@/components/field"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/format"
import { listChannels, type Channel } from "@/lib/channels"
import { barPercent, getSummary, monthToDate, type Summary } from "@/lib/reports"
import { cn } from "@/lib/utils"

type State =
  | { status: "incomplete" } // falta uma das datas: o endpoint exige as duas
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: Summary }

export function Dashboard() {
  // inicializador preguiçoso: monthToDate() só roda na montagem, não a cada render
  const [period, setPeriod] = useState(monthToDate)
  const [channel, setChannel] = useState("")
  const [channels, setChannels] = useState<Channel[]>([])
  const [state, setState] = useState<State>({ status: "loading" })

  // canais alimentam só o filtro; falha aqui não pode derrubar o dashboard
  useEffect(() => {
    listChannels()
      .then(setChannels)
      .catch(() => setChannels([]))
  }, [])

  const load = useCallback(() => {
    // limpar uma data não pode deixar os números do período anterior na tela
    // fingindo que ainda valem: o estado vira explícito e o resumo some
    if (!period.from || !period.to) {
      setState({ status: "incomplete" })
      return
    }
    setState({ status: "loading" })
    getSummary({ from: period.from, to: period.to, ...(channel && { channel }) })
      .then((summary) => setState({ status: "ready", summary }))
      .catch(() => setState({ status: "error" }))
  }, [period, channel])

  useEffect(load, [load])

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label="De"
            type="date"
            required
            value={period.from}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, from: event.target.value }))
            }
          />
          <Field
            label="Até"
            type="date"
            required
            value={period.to}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, to: event.target.value }))
            }
          />
          <SelectField
            label="Canal"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            placeholder="Todos os canais"
            options={channels.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        {/* reports/summary agrega só vendas concluídas; a lista de vendas mostra
            pendentes e canceladas também. Sem esta linha os dois números batem
            diferente e parecem defeito. */}
        <p className="text-xs text-muted-foreground">
          Considera apenas vendas concluídas.
        </p>
      </div>

      {state.status === "incomplete" ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text">Informe as duas datas do período.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O resumo precisa de uma data inicial e uma final.
          </p>
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text">Não foi possível carregar o resumo.</p>
          <Button variant="outline" className="mt-4" onClick={load}>
            Tentar de novo
          </Button>
        </div>
      ) : state.status === "ready" && state.summary.sales_count === 0 ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-16 text-center">
          {/* única superfície com o padrão de chamas nesta tela (regra dura 6) */}
          <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
          <p className="relative font-display text-lg">
            Nenhuma venda concluída no período
          </p>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Ajuste o intervalo ou conclua vendas para ver os indicadores aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {state.status === "loading" ? (
              Array.from({ length: 4 }, (_, index) => <KpiSkeleton key={index} />)
            ) : (
              <>
                <Kpi label="Receita apurada" value={money(state.summary.revenue)} />
                <Kpi
                  label="Lucro apurado"
                  value={money(state.summary.profit)}
                  // prejuízo é o único caso em que o número ganha cor (regra dura 2)
                  danger={Number(state.summary.profit) < 0}
                />
                <Kpi label="Ticket médio" value={money(state.summary.avg_ticket)} />
                <Kpi
                  label="Vendas concluídas"
                  value={String(state.summary.sales_count)}
                />
              </>
            )}
          </div>

          {state.status === "ready" && state.summary.by_channel.length > 0 && (
            <ChannelBreakdown summary={state.summary} />
          )}
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-display text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl tabular-nums sm:text-3xl",
          danger ? "text-danger-ink" : "text-text",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-8 w-28 animate-pulse rounded bg-surface-2" />
    </div>
  )
}

function ChannelBreakdown({ summary }: { summary: Summary }) {
  // a barra é proporcional ao maior faturamento; o 0 protege o Math.max vazio
  const max = Math.max(0, ...summary.by_channel.map((item) => Number(item.revenue)))
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-sm text-muted-foreground">
        Receita apurada por canal
      </h2>
      <div className="mt-4 grid gap-4">
        {summary.by_channel.map((item) => (
          <div key={item.channel} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{item.channel_name}</p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    Number(item.profit) < 0 ? "text-danger-ink" : "text-muted-foreground",
                  )}
                >
                  Lucro {money(item.profit)}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {money(item.revenue)}
              </span>
            </div>
            {/* a barra CODIFICA um dado, então é neutra: cor de marca em série de
                gráfico é proibida (DESIGN.md regra 2 e spec da 2c-2). A cor de
                estado fica no lucro, que é onde ela informa algo. */}
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-muted-foreground/70"
                style={{ width: `${barPercent(item.revenue, max)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
