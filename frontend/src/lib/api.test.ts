import { beforeEach, expect, test, vi } from "vitest"

import { ApiError, apiFetch, fieldError, summaryErrors } from "@/lib/api"
import { useAuth } from "@/store/auth"

beforeEach(() => {
  useAuth.setState({ token: "abc123" })
})

test("injeta o header Authorization quando há token", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200 }),
  )
  vi.stubGlobal("fetch", fetchMock)

  await apiFetch("/api/products/")

  const headers = fetchMock.mock.calls[0][1].headers
  expect(headers.Authorization).toBe("Token abc123")
})

test("401 limpa o token", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })))

  await expect(apiFetch("/api/products/")).rejects.toThrow()
  expect(useAuth.getState().token).toBeNull()
})

test("400 carrega o corpo de erro do DRF", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ maker: ["Produto com tempo de produção precisa de artesã."] }),
        { status: 400 },
      ),
    ),
  )

  const error = await apiFetch("/api/products/").catch((caught) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(fieldError((error as ApiError).fields, "maker")).toBe(
    "Produto com tempo de produção precisa de artesã.",
  )
})

test("erro sem corpo JSON não quebra o parse", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })),
  )

  const error = await apiFetch("/api/products/").catch((caught) => caught)

  expect((error as ApiError).fields).toEqual({})
})

test("summaryErrors achata string solta, lista de strings e itens aninhados", () => {
  const messages = summaryErrors({
    detail: "Sessão expirada.",
    maker: ["Produto com tempo de produção precisa de artesã."],
    items: [{ unit_price: ["Preço deve ser maior que zero."] }, {}],
  })

  expect(messages).toEqual([
    "Sessão expirada.",
    "Produto com tempo de produção precisa de artesã.",
    "Item 1: Preço deve ser maior que zero.",
  ])
})
