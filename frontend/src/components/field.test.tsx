import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { expect, test } from "vitest"

import { MoneyField } from "@/components/field"
import { money } from "@/lib/format"

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <MoneyField label="Total (R$)" name="total" value={value} onValueChange={setValue} />
      <output>{value === "" ? "vazio" : value}</output>
    </>
  )
}

/** Digitar de verdade: cada tecla acrescenta um caractere ao que já está lá. */
function type(input: HTMLInputElement, keys: string) {
  for (const key of keys) {
    fireEvent.change(input, { target: { value: input.value + key } })
  }
}

const field = () => screen.getByLabelText("Total (R$)") as HTMLInputElement

test("os dígitos entram pelos centavos e empurram o valor para a esquerda", () => {
  render(<Harness />)
  type(field(), "1250")

  expect(field().value).toBe(money("12.50"))
  expect(screen.getByText("12.50")).toBeInTheDocument()
})

test("cada dígito sozinho já vale centavo", () => {
  render(<Harness />)
  type(field(), "7")

  expect(field().value).toBe(money("0.07"))
  expect(screen.getByText("0.07")).toBeInTheDocument()
})

test("apagar desfaz na mesma ordem em que entrou", () => {
  render(<Harness />)
  type(field(), "1250")

  // backspace tira o último caractere do que está na tela
  fireEvent.change(field(), { target: { value: field().value.slice(0, -1) } })

  expect(field().value).toBe(money("1.25"))
})

test("esvaziar o campo devolve string vazia, não zero", () => {
  render(<Harness />)
  type(field(), "12")
  fireEvent.change(field(), { target: { value: "" } })

  expect(field().value).toBe("")
  expect(screen.getByText("vazio")).toBeInTheDocument()
})

test("valor que vem da API aparece formatado sem o usuário digitar", () => {
  render(<Harness initial="1234.50" />)

  expect(field().value).toBe(money("1234.50"))
})
