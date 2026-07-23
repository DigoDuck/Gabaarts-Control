import { beforeEach, expect, test, vi } from "vitest"

import {
  buildInput,
  buildTargetInput,
  simulate,
  targetPrice,
} from "@/lib/pricing"
import { useAuth } from "@/store/auth"

beforeEach(() => {
  useAuth.setState({ token: "abc123" })
})

test("buildInput devolve null enquanto faltar produto, canal ou preço > 0", () => {
  expect(buildInput({ product: "", channel: "2", price: "40", freight: "" })).toBeNull()
  expect(buildInput({ product: "1", channel: "", price: "40", freight: "" })).toBeNull()
  expect(buildInput({ product: "1", channel: "2", price: "0", freight: "" })).toBeNull()
  expect(buildInput({ product: "1", channel: "2", price: "", freight: "" })).toBeNull()
})

test("buildInput converte ids para número e omite frete vazio", () => {
  expect(buildInput({ product: "1", channel: "2", price: "40", freight: "" })).toEqual({
    product: 1,
    channel: 2,
    price: "40",
  })
})

test("buildInput mantém o frete quando informado", () => {
  expect(buildInput({ product: "1", channel: "2", price: "40", freight: "5" })).toEqual({
    product: 1,
    channel: 2,
    price: "40",
    freight: "5",
  })
})

test("simulate faz POST no endpoint e devolve o resultado parseado", async () => {
  const body = {
    cogs: "10.00",
    fee: "4.00",
    freight: "0.00",
    profit: "26.00",
    margin_pct: "0.6500",
    status: "na meta ou acima",
  }
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)

  const result = await simulate({ product: 1, channel: 2, price: "40" })

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain("/api/pricing/simulate/")
  expect(init.method).toBe("POST")
  expect(JSON.parse(init.body)).toEqual({ product: 1, channel: 2, price: "40" })
  expect(result).toEqual(body)
})

test("buildTargetInput exige produto, canal e margem utilizável", () => {
  const base = { product: "1", channel: "2", margin: "60", freight: "" }
  expect(buildTargetInput({ ...base, product: "" })).toBeNull()
  expect(buildTargetInput({ ...base, channel: "" })).toBeNull()
  expect(buildTargetInput({ ...base, margin: "" })).toBeNull()
  // o serializer aceita fração até 0.99; 100% seria preço infinito
  expect(buildTargetInput({ ...base, margin: "100" })).toBeNull()
  expect(buildTargetInput({ ...base, margin: "-1" })).toBeNull()
})

test("buildTargetInput converte a margem de percentual para fração de 4 casas", () => {
  expect(
    buildTargetInput({ product: "1", channel: "2", margin: "60", freight: "" }),
  ).toEqual({ product: 1, channel: 2, margin: "0.6000" })
})

test("targetPrice devolve o aviso de zona morta junto do preço e da faixa", async () => {
  const body = {
    price: "79.99",
    tier: {
      id: 3,
      min_price: "0.00",
      commission_pct: "0.2000",
      fixed_fee: "4.00",
    },
    warnings: [
      "Zona morta: entre R$ 80.00 e R$ 88.35 o líquido é menor que em R$ 79.99. " +
        "Fique em R$ 79.99 ou pule para R$ 88.35+.",
    ],
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
  )

  const result = await targetPrice({ product: 1, channel: 2, margin: "0.6000" })

  expect(result.price).toBe("79.99")
  expect(result.tier?.commission_pct).toBe("0.2000")
  expect(result.warnings).toHaveLength(1)
  expect(result.warnings[0]).toContain("Zona morta")
})

test("targetPrice preserva price null quando a margem é inatingível", async () => {
  const body = {
    price: null,
    tier: null,
    warnings: ["Margem inatingível neste canal."],
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
  )

  const result = await targetPrice({ product: 1, channel: 2, margin: "0.9500" })

  // a tela decide a mensagem pelo price null; se virar "" ou 0 ela mente
  expect(result.price).toBeNull()
  expect(result.tier).toBeNull()
  expect(result.warnings[0]).toContain("inatingível")
})
