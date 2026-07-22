import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Flame } from "@/components/brand"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { money, percent } from "@/lib/format"
import { CATEGORY_LABELS, listProducts, type Product } from "@/lib/products"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] }

export function Products() {
  const [state, setState] = useState<State>({ status: "loading" })
  const navigate = useNavigate()

  const load = useCallback(() => {
    setState({ status: "loading" })
    listProducts()
      .then((products) => setState({ status: "ready", products }))
      .catch(() => setState({ status: "error" }))
  }, [])

  useEffect(load, [load])

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text">Não foi possível carregar os produtos.</p>
        <p className="mt-1 text-sm text-muted-foreground">Verifique a conexão com a API.</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (state.status === "ready" && state.products.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-16 text-center">
        {/* única superfície com o padrão de chamas nesta tela (regra dura 6) */}
        <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
        <p className="relative font-display text-lg">Nenhum produto cadastrado</p>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Comece cadastrando o primeiro produto.
        </p>
        <Button asChild className="relative mt-4">
          <Link to="/products/new">Novo produto</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/products/new">Novo produto</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface hover:bg-surface">
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Produto
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Categoria
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Custo unitário
              </TableHead>
              {/* rótulo explícito: o sugerido não desconta taxa de canal nem frete */}
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Preço sugerido (direta)
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Margem alvo
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Situação
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {state.status === "loading"
              ? // skeleton com a mesma grade da tabela: a linha não pula ao carregar
                Array.from({ length: 5 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: 6 }, (_, col) => (
                      <TableCell key={col}>
                        <div className="h-4 animate-pulse rounded bg-surface-2" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : state.products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {product.name}
                        {product.is_combo && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Kit
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {CATEGORY_LABELS[product.category]}
                    </TableCell>
                    {/* dado é neutro: valor nunca recebe cor de marca (regra dura 2) */}
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money(product.cogs.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(product.suggested_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {percent(product.target_margin_pct)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <span
                          className={`size-1.5 rounded-full ${
                            product.is_active ? "bg-success" : "bg-muted-foreground"
                          }`}
                        />
                        {product.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
