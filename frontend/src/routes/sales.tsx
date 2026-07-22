import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Flame } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Field } from "@/components/field"
import { money } from "@/lib/format"
import { listSales, STATUS_LABELS, type Sale } from "@/lib/sales"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; sales: Sale[] }

export function Sales() {
  const [state, setState] = useState<State>({ status: "loading" })
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const navigate = useNavigate()

  const load = useCallback(() => {
    setState({ status: "loading" })
    // a API exige from e to juntos; um só preenchido não filtra nada
    const range = from && to ? { from, to } : {}
    listSales(range)
      .then((sales) => setState({ status: "ready", sales }))
      .catch(() => setState({ status: "error" }))
  }, [from, to])

  useEffect(load, [load])

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text">Não foi possível carregar as vendas.</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-3">
          <Field
            label="De"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Field
            label="Até"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <Button asChild>
          <Link to="/sales/new">Nova venda</Link>
        </Button>
      </div>

      {state.status === "ready" && state.sales.length === 0 ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-16 text-center">
          {/* única superfície com o padrão de chamas nesta tela (regra dura 6) */}
          <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
          <p className="relative font-display text-lg">Nenhuma venda no período</p>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Registre a primeira venda para ver receita e lucro aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface hover:bg-surface">
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Data
                </TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Canal
                </TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Cliente
                </TableHead>
                <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Total
                </TableHead>
                <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Lucro
                </TableHead>
                <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Situação
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {state.status === "loading"
                ? Array.from({ length: 5 }, (_, row) => (
                    <TableRow key={row}>
                      {Array.from({ length: 6 }, (_, col) => (
                        <TableCell key={col}>
                          <div className="h-4 animate-pulse rounded bg-surface-2" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : state.sales.map((sale) => (
                    <TableRow
                      key={sale.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/sales/${sale.id}`)}
                    >
                      <TableCell className="tabular-nums">
                        {sale.date.split("-").reverse().join("/")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.channel_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.customer_name || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(sale.total)}
                      </TableCell>
                      {/* prejuízo é o único caso em que o número ganha cor (DESIGN.md, regra dura 2) */}
                      <TableCell
                        className={`text-right tabular-nums ${
                          Number(sale.profit) < 0 ? "text-danger-ink" : "text-muted-foreground"
                        }`}
                      >
                        {money(sale.profit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {STATUS_LABELS[sale.status]}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
