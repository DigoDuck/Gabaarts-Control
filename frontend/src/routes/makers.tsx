import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Flame } from "@/components/brand"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/format"
import { listMakers, type Maker } from "@/lib/makers"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; makers: Maker[] }

export function Makers() {
  const [state, setState] = useState<State>({ status: "loading" })
  const navigate = useNavigate()

  const load = useCallback(() => {
    setState({ status: "loading" })
    listMakers()
      .then((makers) => setState({ status: "ready", makers }))
      .catch(() => setState({ status: "error" }))
  }, [])

  useEffect(load, [load])

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text">Não foi possível carregar as artesãs.</p>
        <p className="mt-1 text-sm text-muted-foreground">Verifique a conexão com a API.</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (state.status === "ready" && state.makers.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-16 text-center">
        {/* única superfície com o padrão de chamas nesta tela (regra dura 6) */}
        <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
        <p className="relative font-display text-lg">Nenhuma artesã cadastrada</p>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Comece cadastrando a primeira artesã.
        </p>
        <Button asChild className="relative mt-4">
          <Link to="/makers/new">Nova artesã</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/makers/new">Nova artesã</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface hover:bg-surface">
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Artesã
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Custo por hora
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {state.status === "loading"
              ? // skeleton com a mesma grade da tabela: a linha não pula ao carregar
                Array.from({ length: 5 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: 2 }, (_, col) => (
                      <TableCell key={col}>
                        <div className="h-4 animate-pulse rounded bg-surface-2" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : state.makers.map((maker) => (
                  <TableRow
                    key={maker.id}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-violet"
                    tabIndex={0}
                    role="link"
                    aria-label={`Editar ${maker.name}`}
                    onClick={() => navigate(`/makers/${maker.id}`)}
                    onKeyDown={(event) => {
                      // linha da tabela não é botão nativo: Enter e Espaço na mão
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        navigate(`/makers/${maker.id}`)
                      }
                    }}
                  >
                    <TableCell className="font-medium">{maker.name}</TableCell>
                    {/* dado é neutro: valor nunca recebe cor de marca (regra dura 2) */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money(maker.hourly_rate)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
