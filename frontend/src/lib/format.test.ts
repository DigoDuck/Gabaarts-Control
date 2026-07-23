import { expect, test } from "vitest"

import { fractionToPercent, money, percent, percentToFraction } from "@/lib/format"

test("fração do domínio vira percentual do formulário", () => {
  expect(fractionToPercent("0.5000")).toBe("50")
  expect(fractionToPercent("0.2250")).toBe("22.5")
  expect(fractionToPercent("0")).toBe("0")
})

test("percentual do formulário vira fração de 4 casas", () => {
  expect(percentToFraction("50")).toBe("0.5000")
  expect(percentToFraction("22.5")).toBe("0.2250")
  expect(percentToFraction("")).toBe("0.0000")
})

test("ida e volta preserva o valor", () => {
  expect(percentToFraction(fractionToPercent("0.1234"))).toBe("0.1234")
})

test("money e percent continuam formatando em pt-BR", () => {
  expect(money("15.16")).toContain("15,16")
  expect(percent("0.5000")).toContain("50")
})

test("fração que não multiplica limpo não vaza ruído de ponto flutuante", () => {
  expect(fractionToPercent("0.1400")).toBe("14")
  expect(fractionToPercent("0.2900")).toBe("29")
  expect(fractionToPercent("0.0350")).toBe("3.5")
})
