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
import { listChannels, type Channel } from "@/lib/channels"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; channels: Channel[] }

/** Nº de faixas em português; canal sem faixa é válido (usa só o frete padrão). */
function tierLabel(count: number) {
  if (count === 0) return "Sem faixas"
  return count === 1 ? "1 faixa" : `${count} faixas`
}

export function Channels() {
  const [state, setState] = useState<State>({ status: "loading" })
  const navigate = useNavigate()

  const load = useCallback(() => {
    setState({ status: "loading" })
    listChannels()
      .then((channels) => setState({ status: "ready", channels }))
      .catch(() => setState({ status: "error" }))
  }, [])

  useEffect(load, [load])

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text">Não foi possível carregar os canais.</p>
        <p className="mt-1 text-sm text-muted-foreground">Verifique a conexão com a API.</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (state.status === "ready" && state.channels.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-16 text-center">
        {/* única superfície com o padrão de chamas nesta tela (regra dura 6) */}
        <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
        <p className="relative font-display text-lg">Nenhum canal cadastrado</p>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Comece cadastrando o primeiro canal de venda.
        </p>
        <Button asChild className="relative mt-4">
          <Link to="/channels/new">Novo canal</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/channels/new">Novo canal</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface hover:bg-surface">
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Canal
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Slug
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Frete padrão
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Faixas
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {state.status === "loading"
              ? // skeleton com a mesma grade da tabela: a linha não pula ao carregar
                Array.from({ length: 5 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: 4 }, (_, col) => (
                      <TableCell key={col}>
                        <div className="h-4 animate-pulse rounded bg-surface-2" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : state.channels.map((channel) => (
                  <TableRow
                    key={channel.id}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-violet"
                    tabIndex={0}
                    role="link"
                    aria-label={`Editar ${channel.name}`}
                    onClick={() => navigate(`/channels/${channel.id}`)}
                    onKeyDown={(event) => {
                      // linha da tabela não é botão nativo: Enter e Espaço na mão
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        navigate(`/channels/${channel.id}`)
                      }
                    }}
                  >
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    {/* dado é neutro: slug e valores nunca recebem cor de marca (regra dura 2) */}
                    <TableCell className="text-muted-foreground">{channel.slug}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {channel.default_freight ? money(channel.default_freight) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {tierLabel(channel.fee_tiers.length)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
