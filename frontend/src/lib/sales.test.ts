import { beforeEach, expect, test, vi } from "vitest"

import { previewSale } from "@/lib/sales"
import { useAuth } from "@/store/auth"

beforeEach(() => {
  useAuth.setState({ token: "abc123" })
})

test("envia os fatos financeiros para a prévia da venda", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ profit: "30.00" }), { status: 200 }),
  )
  vi.stubGlobal("fetch", fetchMock)

  await previewSale({
    channel: 3,
    products_total: "100.00",
    shipping_amount: "12.00",
    fee_override: "18.00",
    items: [{ product: 7, qty: 2 }],
  })

  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:8000/api/sales/preview/",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        channel: 3,
        products_total: "100.00",
        shipping_amount: "12.00",
        fee_override: "18.00",
        items: [{ product: 7, qty: 2 }],
      }),
    }),
  )
})
