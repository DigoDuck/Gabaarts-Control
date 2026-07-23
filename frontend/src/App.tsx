import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { ChannelForm } from "@/routes/channel-form"
import { Channels } from "@/routes/channels"
import { Dashboard } from "@/routes/dashboard"
import { Equipment } from "@/routes/equipment"
import { EquipmentForm } from "@/routes/equipment-form"
import { Login } from "@/routes/login"
import { MakerForm } from "@/routes/maker-form"
import { Makers } from "@/routes/makers"
import { Pricing } from "@/routes/pricing"
import { ProductForm } from "@/routes/product-form"
import { Products } from "@/routes/products"
import { SaleForm } from "@/routes/sale-form"
import { Sales } from "@/routes/sales"
import { Tokens } from "@/routes/tokens"

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
          <Route path="/sales/new" element={<SaleForm />} />
          <Route path="/sales/:id" element={<SaleForm />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/channels/new" element={<ChannelForm />} />
          <Route path="/channels/:id" element={<ChannelForm />} />
          <Route path="/makers" element={<Makers />} />
          <Route path="/makers/new" element={<MakerForm />} />
          <Route path="/makers/:id" element={<MakerForm />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/equipment/new" element={<EquipmentForm />} />
          <Route path="/equipment/:id" element={<EquipmentForm />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
