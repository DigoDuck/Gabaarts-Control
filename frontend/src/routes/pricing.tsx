import { TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Flame } from "@/components/brand"
import { Field, SelectField } from "@/components/field"
import { Button } from "@/components/ui/button"
import { money, percent } from "@/lib/format"
import { listChannels, type Channel } from "@/lib/channels"
import { listProducts, type Product } from "@/lib/products"
import {
  BELOW_TARGET,
  buildInput,
  buildTargetInput,
  simulate,
  targetPrice,
  type SimulateResult,
  type TargetPriceResult,
} from "@/lib/pricing"

type State<R> =
  | { status: "idle" } // faltam campos: nada a calcular ainda
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; result: R }

/**
 * Dispara `run` 400ms depois da última mudança (mesmo debounce do painel de
 * custo do produto). `dropped` descarta resposta fora de ordem: uma requisição
 * lenta disparada antes não pode sobrescrever a rápida disparada depois.
 * O input vira JSON para servir de dependência estável do efeito.
 */
function useLiveResult<I, R>(input: I | null, run: (input: I) => Promise<R>) {
  const [state, setState] = useState<State<R>>({ status: "idle" })
  const [stale, setStale] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const key = input ? JSON.stringify(input) : ""

  useEffect(() => {
    if (!key) {
      setState({ status: "idle" })
      setStale(false)
      return
    }
    let dropped = false
    setStale(true)
    const timer = setTimeout(() => {
      // mantém o resultado anterior esmaecido durante o recálculo; "loading"
      // só na primeira vez, quando ainda não há o que manter na tela
      setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }))
      run(JSON.parse(key) as I)
        .then((result) => {
          if (dropped) return
          setState({ status: "ready", result })
          setStale(false)
        })
        .catch(() => {
          if (dropped) return
          setState({ status: "error" })
          setStale(false)
        })
    }, 400)
    return () => {
      dropped = true
      clearTimeout(timer)
    }
  }, [key, attempt, run])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  return { state, stale, retry }
}

export function Pricing() {
  const [product, setProduct] = useState("")
  const [channel, setChannel] = useState("")
  const [freight, setFreight] = useState("")
  const [price, setPrice] = useState("")
  const [margin, setMargin] = useState("")

  const [products, setProducts] = useState<Product[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    // produto inativo não se vende: simular preço dele não ajuda a decidir
    listProducts()
      .then((all) => setProducts(all.filter((item) => item.is_active)))
      .catch(() => setProducts([]))
    listChannels()
      .then(setChannels)
      .catch(() => setChannels([]))
  }, [])

  const simulation = useLiveResult(
    buildInput({ product, channel, price, freight }),
    simulate,
  )
  const target = useLiveResult(
    buildTargetInput({ product, channel, margin, freight }),
    targetPrice,
  )

  const chosen = product !== "" && channel !== ""

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Simulação hipotética: nada aqui registra venda nem altera o histórico.
      </p>

      <div className="grid max-w-2xl gap-4">
        <SelectField
          label="Produto"
          name="product"
          value={product}
          placeholder="Escolha um produto"
          options={products.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(event) => setProduct(event.target.value)}
        />
        <SelectField
          label="Canal"
          name="channel"
          value={channel}
          placeholder="Escolha o canal"
          options={channels.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(event) => setChannel(event.target.value)}
        />
        <Field
          label="Frete (R$)"
          name="freight"
          type="number"
          step="0.01"
          min="0"
          hint="Vazio usa o frete padrão do canal."
          value={freight}
          onChange={(event) => setFreight(event.target.value)}
        />
      </div>

      {!chosen ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface px-8 py-14 text-center">
          {/* única chama da tela (DESIGN.md, regra dura 6) */}
          <Flame className="pointer-events-none absolute right-4 -bottom-16 size-64 text-brand-violet opacity-5" />
          <p className="relative text-sm text-muted-foreground">
            Escolha produto e canal para simular.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Mode
            title="Margem num preço"
            question="Vendendo a este preço, sobra quanto?"
          >
            <Field
              label="Preço de venda (R$)"
              name="price"
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <Panel
              state={simulation.state}
              stale={simulation.stale}
              onRetry={simulation.retry}
              hint="Informe um preço para ver o resultado."
            >
              {(result: SimulateResult) => <Simulation result={result} />}
            </Panel>
          </Mode>

          <Mode
            title="Preço para a margem-alvo"
            question="Para bater esta margem, cobro quanto?"
          >
            <Field
              label="Margem desejada (%)"
              name="margin"
              type="number"
              step="0.01"
              min="0"
              max="99"
              value={margin}
              onChange={(event) => setMargin(event.target.value)}
            />
            <Panel
              state={target.state}
              stale={target.stale}
              onRetry={target.retry}
              hint="Informe a margem desejada para ver o preço."
            >
              {(result: TargetPriceResult) => <Target result={result} />}
            </Panel>
          </Mode>
        </div>
      )}
    </div>
  )
}

function Mode({
  title,
  question,
  children,
}: {
  title: string
  question: string
  children: React.ReactNode
}) {
  return (
    <section className="grid content-start gap-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="font-display text-sm tracking-wide uppercase">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{question}</p>
      </div>
      {children}
    </section>
  )
}

/** Casca comum dos dois modos: idle, erro com retry, carregando e resultado. */
function Panel<R>({
  state,
  stale,
  onRetry,
  hint,
  children,
}: {
  state: State<R>
  stale: boolean
  onRetry: () => void
  hint: string
  children: (result: R) => React.ReactNode
}) {
  if (state.status === "idle") {
    return <p className="text-sm text-muted-foreground">{hint}</p>
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/40 px-3 py-2">
        <p className="text-sm text-danger-ink">Não foi possível calcular.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Calculando…</p>
  }

  return (
    <div className={`transition-opacity ${stale ? "opacity-50" : "opacity-100"}`}>
      {children(state.result)}
    </div>
  )
}

function Simulation({ result }: { result: SimulateResult }) {
  const loss = Number(result.profit) < 0
  const belowTarget = result.status === BELOW_TARGET

  return (
    <>
      <dl className="grid gap-2 text-sm">
        <Row label="Custo unitário" value={money(result.cogs)} />
        <Row label="Taxa do canal" value={money(result.fee)} />
        <Row label="Frete" value={money(result.freight)} />

        <div className="mt-1 grid gap-2 border-t border-border pt-2">
          <Row label="Lucro" value={money(result.profit)} strong danger={loss} />
          <Row
            label="Margem"
            value={percent(result.margin_pct)}
            strong
            danger={belowTarget}
          />
        </div>
      </dl>

      {/* a frase da situação só vira vermelha quando fica abaixo da meta */}
      <p
        className={`mt-3 text-sm ${
          belowTarget ? "text-danger-ink" : "text-muted-foreground"
        }`}
      >
        {belowTarget
          ? "Margem abaixo da meta do produto."
          : "Margem na meta ou acima."}
      </p>
    </>
  )
}

function Target({ result }: { result: TargetPriceResult }) {
  // preço null = nenhuma faixa do canal entrega essa margem; o backend explica
  // o motivo em warnings, então aqui não se inventa mensagem
  if (result.price === null) {
    return (
      <div className="grid gap-2">
        <p className="text-sm text-danger-ink">
          Não há preço que entregue essa margem neste canal.
        </p>
        {result.warnings.map((warning, index) => (
          <p key={index} className="text-sm text-muted-foreground">
            {warning}
          </p>
        ))}
      </div>
    )
  }

  return (
    <>
      <dl className="grid gap-2 text-sm">
        <Row label="Preço mínimo" value={money(result.price)} strong />
        {result.tier && (
          <>
            <Row
              label="Faixa a partir de"
              value={money(result.tier.min_price)}
            />
            <Row label="Comissão da faixa" value={percent(result.tier.commission_pct)} />
            <Row label="Taxa fixa da faixa" value={money(result.tier.fixed_fee)} />
          </>
        )}
      </dl>

      {/* zona morta: o achado que justifica esta tela. Destaque por moldura e
          ícone, não por cor nova — o DESIGN.md só tem rampa AA para erro e
          acento, e criar um token de aviso exigiria registro antes do uso. */}
      {result.warnings.map((warning, index) => (
        <div
          key={index}
          className="mt-3 flex gap-2 rounded-md border border-border bg-surface-2 p-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-text">{warning}</p>
        </div>
      ))}
    </>
  )
}

function Row({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      {/* dado é neutro por padrão; cor só quando significa prejuízo/abaixo da meta */}
      <dd
        className={`tabular-nums ${
          danger ? "text-danger-ink" : strong ? "text-text" : "text-muted-foreground"
        } ${strong ? "font-medium" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}
