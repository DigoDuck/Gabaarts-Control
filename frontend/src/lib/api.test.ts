import { beforeEach, expect, test, vi } from "vitest"

import { apiFetch } from "@/lib/api"
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
