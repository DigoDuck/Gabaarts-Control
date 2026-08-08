import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, test, vi } from "vitest"

import { SaleForm } from "@/routes/sale-form"
import { selectProduct } from "@/routes/sale-form-state"

const api = vi.hoisted(() => ({
  createSale: vi.fn(),
  getSale: vi.fn(),
  listChannels: vi.fn(),
  listProducts: vi.fn(),
  previewSale: vi.fn(),
  updateSale: vi.fn(),
}))

vi.mock("@/lib/channels", () => ({
  listChannels: api.listChannels,
}))
vi.mock("@/lib/products", () => ({
  listProducts: api.listProducts,
}))
vi.mock("@/lib/sales", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sales")>()),
  createSale: api.createSale,
  getSale: api.getSale,
  previewSale: api.previewSale,
  updateSale: api.updateSale,
}))

const result = (profit: string) => ({
  total_cogs: "50.00",
  suggested_channel_fee: "20.00",
  applied_channel_fee: "20.00",
  fee_source: "suggested" as const,
  profit,
  margin_pct: "0.3000",
  target_margin_pct: "0.5000",
  amount_paid: "112.00",
  warnings: [],
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderForm(path = "/sales/new") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sales/new" element={<SaleForm />} />
        <Route path="/sales/:id" element={<SaleForm />} />
        <Route path="/sales" element={<p>Lista de vendas</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillFinancialFields(total = "100") {
  await screen.findByRole("option", { name: "Caneca" })
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-08" } })
  fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "1" } })
  fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "7" } })
  fireEvent.change(screen.getByLabelText("Total dos produtos (R$)"), {
    target: { value: total },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listChannels.mockResolvedValue([
    { id: 1, name: "Shopee", slug: "shopee", default_freight: "0", fee_tiers: [] },
  ])
  api.listProducts.mockResolvedValue([
    {
      id: 7,
      name: "Caneca",
      is_active: true,
      base_price: "40.00",
      cogs: { material: "10", labor: "2", packaging: "3", total: "15.00" },
    },
  ])
})

test("selecionar o mesmo produto soma a quantidade em vez de duplicar a linha", () => {
  expect(
    selectProduct(
      [
        { product: "7", qty: "2" },
        { product: "", qty: "1" },
      ],
      1,
      "7",
    ),
  ).toEqual([{ product: "7", qty: "3" }])
})

test("mostra lucro total após a prévia e só então libera o salvamento", async () => {
  api.previewSale.mockResolvedValue(result("30.00"))
  renderForm()
  await fillFinancialFields()

  expect(screen.getByRole("button", { name: "Salvar venda" })).toBeDisabled()
  await waitFor(() => expect(api.previewSale).toHaveBeenCalled(), { timeout: 1_000 })

  expect(await screen.findByText("R$ 30,00")).toBeInTheDocument()
  expect(screen.getByText("Custo estimado")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Salvar venda" })).toBeEnabled()
})

test("uma resposta antiga não substitui a prévia mais recente", async () => {
  const first = deferred<ReturnType<typeof result>>()
  const second = deferred<ReturnType<typeof result>>()
  api.previewSale.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  renderForm()
  await fillFinancialFields("80")
  await waitFor(() => expect(api.previewSale).toHaveBeenCalledTimes(1), { timeout: 1_000 })

  fireEvent.change(screen.getByLabelText("Total dos produtos (R$)"), {
    target: { value: "100" },
  })
  await waitFor(() => expect(api.previewSale).toHaveBeenCalledTimes(2), { timeout: 1_000 })

  await act(async () => second.resolve(result("30.00")))
  expect(await screen.findByText("R$ 30,00")).toBeInTheDocument()

  await act(async () => first.resolve(result("5.00")))
  expect(screen.queryByText("R$ 5,00")).not.toBeInTheDocument()
  expect(screen.getByText("R$ 30,00")).toBeInTheDocument()
})

test("permite substituir a sugestão pela taxa total realmente cobrada", async () => {
  api.previewSale.mockResolvedValue({ ...result("25.00"), fee_source: "manual" })
  renderForm()
  await fillFinancialFields()
  fireEvent.click(screen.getByLabelText("Informar a taxa real cobrada pela plataforma"))
  fireEvent.change(screen.getByLabelText("Taxa total da plataforma (R$)"), {
    target: { value: "25" },
  })

  await waitFor(() =>
    expect(api.previewSale).toHaveBeenLastCalledWith(
      expect.objectContaining({ fee_override: "25" }),
    ),
  { timeout: 1_000 })
  expect(await screen.findByText("Taxa aplicada")).toBeInTheDocument()
})

test("editar apenas o cliente preserva e mostra o resultado congelado", async () => {
  api.getSale.mockResolvedValue({
    id: 9,
    date: "2026-08-08",
    channel: 1,
    channel_name: "Shopee",
    customer_name: "Ana",
    status: "completed",
    products_total: "100.00",
    shipping_amount: "12.00",
    channel_fee: "20.00",
    fee_source: "suggested",
    total_cogs: "50.00",
    profit: "30.00",
    margin_pct: "0.3000",
    amount_paid: "112.00",
    items: [{ id: 4, product: 7, product_name: "Caneca", qty: 2, unit_cogs: "25.00" }],
  })
  api.updateSale.mockResolvedValue({})
  renderForm("/sales/9")

  expect(await screen.findByText("Resultado congelado")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Beatriz" } })
  fireEvent.click(screen.getByRole("button", { name: "Salvar venda" }))

  await waitFor(() => expect(api.updateSale).toHaveBeenCalledWith(9, {
    customer_name: "Beatriz",
  }))
  expect(api.previewSale).not.toHaveBeenCalled()
})
