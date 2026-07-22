import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppShell, NAV } from "@/components/app-shell"
import { Login } from "@/routes/login"
import { ProductForm } from "@/routes/product-form"
import { Products } from "@/routes/products"
import { Sales } from "@/routes/sales"
import { Tokens } from "@/routes/tokens"

// rotas da 2c: o shell já navega para elas antes das telas existirem
function Soon() {
  return <p className="text-sm text-muted-foreground">Esta tela chega na fase 2c.</p>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route element={<AppShell />}>
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/:id" element={<ProductForm />} />
          <Route path="/sales" element={<Sales />} />
          {NAV.filter((item) => !["/products", "/sales"].includes(item.to)).map((item) => (
            <Route key={item.to} path={item.to} element={<Soon />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
