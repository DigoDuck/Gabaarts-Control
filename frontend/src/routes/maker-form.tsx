import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Field } from "@/components/field"
import { Button } from "@/components/ui/button"
import { ApiError, fieldError, summaryErrors, type FieldErrors } from "@/lib/api"
import { createMaker, getMaker, updateMaker, type MakerPayload } from "@/lib/makers"

// estado do formulário: tudo string, como sai de <input>. A conversão para o
// formato do domínio acontece uma vez, em toPayload().
type FormState = {
  name: string
  hourly_rate: string
}

const EMPTY: FormState = {
  name: "",
  hourly_rate: "",
}

function toPayload(form: FormState): MakerPayload {
  return {
    name: form.name,
    // required no model; o "0" só protege caso o required do HTML seja burlado
    hourly_rate: form.hourly_rate || "0",
  }
}

export function MakerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = id !== undefined

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // enquanto o GET não volta, o form ainda mostra os vazios de EMPTY; salvar
  // aqui gravaria vazio por cima do dado real, porque o PUT escreve tudo
  const [loading, setLoading] = useState(editing)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!editing) {
      setLoading(false)
      return
    }
    setLoading(true)
    getMaker(Number(id))
      .then((maker) => setForm({ name: maker.name, hourly_rate: maker.hourly_rate }))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [editing, id])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (editing && loadError) {
        // salvar sobre um formulário que não carregou zeraria o custo/hora
        setErrors({ detail: ["Esta artesã não foi carregada. Recarregue a página."] })
        return
      }
      setSaving(true)
      setErrors({})
      try {
        const payload = toPayload(form)
        if (editing) await updateMaker(Number(id), payload)
        else await createMaker(payload)
        navigate("/makers")
      } catch (error) {
        if (error instanceof ApiError) setErrors(error.fields)
        else setErrors({ non_field_errors: ["Não foi possível salvar."] })
      } finally {
        setSaving(false)
      }
    },
    [editing, form, id, loadError, navigate],
  )

  const resumo = summaryErrors(errors)

  return (
    <form onSubmit={submit} className="grid max-w-lg gap-4 content-start">
      {loadError && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          Não foi possível carregar esta artesã. Volte à lista e tente de novo.
        </p>
      )}

      {resumo.length > 0 && (
        <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-danger-ink">
          {resumo.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}

      <Field
        label="Nome"
        name="name"
        required
        value={form.name}
        error={fieldError(errors, "name")}
        onChange={(event) => set("name", event.target.value)}
      />

      <Field
        label="Custo por hora (R$)"
        name="hourly_rate"
        type="number"
        step="0.01"
        min="0"
        required
        hint="Quanto custa uma hora de trabalho desta artesã."
        value={form.hourly_rate}
        error={fieldError(errors, "hourly_rate")}
        onChange={(event) => set("hourly_rate", event.target.value)}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || loading}>
          {saving ? "Salvando…" : loading ? "Carregando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/makers")}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
