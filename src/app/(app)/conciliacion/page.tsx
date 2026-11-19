'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Cuenta {
  id: string
  alias: string | null
  numero: string
  banco: string
}

interface Conciliacion {
  id: string
  confianza: 'exacta' | 'probable'
  tipo: string
  monto_aplicado: number
  confirmado_por: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  movimientos_bancarios: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  facturas: any
}

interface MovSinCalzar {
  id: string
  fecha: string
  descripcion: string
  abono: number
}

interface FactVencida {
  id: string
  numero: string
  monto: number
  fecha_emision: string
  institucion: string | null
  dias: number
}

type Pestaña = 'calzados' | 'dudosos' | 'sin_calzar'

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ConciliacionPage() {
  const supabase = createClient()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [cuentaId, setCuentaId] = useState<string>('')
  const [pestaña, setPestaña] = useState<Pestaña>('calzados')
  const [calzados, setCalzados] = useState<Conciliacion[]>([])
  const [dudosos, setDudosos] = useState<Conciliacion[]>([])
  const [sinCalzar, setSinCalzar] = useState<MovSinCalzar[]>([])
  const [vencidas, setVencidas] = useState<FactVencida[]>([])
  const [cargando, setCargando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    supabase.from('cuentas_bancarias').select('id, alias, numero, banco').then(({ data }) => {
      setCuentas(data ?? [])
      if (data && data.length > 0) setCuentaId(data[0].id)
    })
  }, [supabase])

  const cargar = useCallback(async () => {
    if (!cuentaId) return
    setCargando(true)
    setMsg(null)

    // Obtener IDs de movimientos de esta cuenta para filtrar conciliaciones
    const { data: movIds } = await supabase
      .from('movimientos_bancarios')
      .select('id')
      .eq('cuenta_id', cuentaId)
    const ids = (movIds ?? []).map((m: { id: string }) => m.id)

    const { data: concs } = ids.length > 0
      ? await supabase
          .from('conciliaciones')
          .select(`
            id, confianza, tipo, monto_aplicado, confirmado_por,
            movimientos_bancarios ( fecha, descripcion, abono ),
            facturas ( id, numero, monto )
          `)
          .in('movimiento_id', ids)
          .order('id', { ascending: false })
      : { data: [] }

    setCalzados((concs ?? []).filter((c: Conciliacion) => c.confianza === 'exacta'))
    setDudosos((concs ?? []).filter((c: Conciliacion) => c.confianza === 'probable'))

    // Movimientos sin calzar
    const { data: movs } = await supabase
      .from('movimientos_bancarios')
      .select('id, fecha, descripcion, abono')
      .eq('cuenta_id', cuentaId)
      .gt('abono', 0)
      .not('id', 'in', `(select movimiento_id from conciliaciones)`)
      .order('fecha', { ascending: false })
      .limit(100)
    setSinCalzar(movs ?? [])

    // Facturas vencidas (> 30 días, impagas)
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const { data: fvenc } = await supabase
      .from('facturas')
      .select('id, numero, monto, fecha_emision, licitaciones(institucion)')
      .is('fecha_pago', null)
      .lt('fecha_emision', hace30)
      .order('fecha_emision')
      .limit(50)
    setVencidas(
      (fvenc ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        numero: f.numero as string,
        monto: f.monto as number,
        fecha_emision: f.fecha_emision as string,
        institucion: (f.licitaciones as { institucion?: string } | null)?.institucion ?? null,
        dias: diasDesde(f.fecha_emision as string),
      }))
    )

    setCargando(false)
  }, [cuentaId, supabase])

  useEffect(() => { if (cuentaId) cargar() }, [cuentaId, cargar])

  async function correrConciliacion() {
    if (!cuentaId) return
    setCargando(true)
    setMsg(null)
    const res = await fetch('/api/conciliacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta_id: cuentaId }),
    })
    const json = await res.json()
    setMsg(res.ok ? `✓ ${json.calces} calces encontrados, ${json.insertados} guardados` : json.error)
    await cargar()
  }

  async function confirmarExactas() {
    if (!cuentaId) return
    setConfirmando(true)
    const res = await fetch('/api/conciliacion/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exactas: true, cuenta_id: cuentaId }),
    })
    const json = await res.json()
    setMsg(res.ok ? `✓ ${json.confirmadas} facturas marcadas como pagadas` : json.error)
    setConfirmando(false)
    await cargar()
  }

  async function subirCartola(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !cuentaId) return
    setSubiendo(true)
    setMsg(null)
    const form = new FormData()
    form.append('archivo', file)
    form.append('cuenta_id', cuentaId)
    const res = await fetch('/api/import/cartola', { method: 'POST', body: form })
    const json = await res.json()
    if (res.ok) {
      setMsg(`✓ ${json.filasParsed} filas importadas (${json.filasInserted} nuevas)`)
      await cargar()
    } else {
      setMsg(`Error: ${json.error}`)
    }
    setSubiendo(false)
    e.target.value = ''
  }

  const sinConfirmar = calzados.filter(c => !c.confirmado_por)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-xl font-semibold flex-1">Conciliación bancaria</h1>

        {/* Selector de cuenta */}
        <select
          value={cuentaId}
          onChange={e => setCuentaId(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-zinc-900"
        >
          {cuentas.map(c => (
            <option key={c.id} value={c.id}>{c.alias ?? c.numero} — {c.banco}</option>
          ))}
        </select>

        {/* Subir cartola */}
        <label className={`cursor-pointer text-sm px-3 py-1.5 rounded border font-medium
          ${subiendo ? 'opacity-50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
          {subiendo ? 'Subiendo…' : '+ Subir cartola'}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={subirCartola} disabled={subiendo} />
        </label>

        <button
          onClick={correrConciliacion}
          disabled={cargando}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Procesando…' : 'Conciliar'}
        </button>
      </div>

      {msg && (
        <p className={`text-sm px-3 py-2 rounded ${msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </p>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 border-b">
        {(['calzados', 'dudosos', 'sin_calzar'] as Pestaña[]).map(p => (
          <button
            key={p}
            onClick={() => setPestaña(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${pestaña === p
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
          >
            {p === 'calzados' ? `Calzados (${calzados.length})` :
             p === 'dudosos'  ? `Dudosos (${dudosos.length})` :
             `Sin calzar (${sinCalzar.length + vencidas.length})`}
          </button>
        ))}
      </div>

      {/* ── Calzados ── */}
      {pestaña === 'calzados' && (
        <div className="space-y-3">
          {sinConfirmar.length > 0 && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 rounded px-4 py-3">
              <span className="text-sm">{sinConfirmar.length} calces exactos listos para confirmar</span>
              <button
                onClick={confirmarExactas}
                disabled={confirmando}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {confirmando ? 'Confirmando…' : 'Confirmar todos los exactos'}
              </button>
            </div>
          )}
          <TablaCalces rows={calzados} />
        </div>
      )}

      {/* ── Dudosos ── */}
      {pestaña === 'dudosos' && <TablaCalces rows={dudosos} onConfirmar={cargar} />}

      {/* ── Sin calzar ── */}
      {pestaña === 'sin_calzar' && (
        <div className="space-y-6">
          {sinCalzar.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-zinc-500 uppercase tracking-wide">
                Abonos sin factura ({sinCalzar.length})
              </h2>
              <div className="rounded border overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 text-left">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2 text-right">Abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sinCalzar.map(m => (
                      <tr key={m.id} className="border-t hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="px-3 py-2 whitespace-nowrap">{m.fecha}</td>
                        <td className="px-3 py-2 max-w-xs truncate">{m.descripcion}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCLP(m.abono)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vencidas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-zinc-500 uppercase tracking-wide">
                Facturas vencidas sin abono ({vencidas.length})
              </h2>
              <div className="rounded border overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 text-left">
                    <tr>
                      <th className="px-3 py-2">N° Factura</th>
                      <th className="px-3 py-2">Institución</th>
                      <th className="px-3 py-2">Emisión</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                      <th className="px-3 py-2 text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vencidas.map(f => (
                      <tr key={f.id} className="border-t hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="px-3 py-2">{f.numero}</td>
                        <td className="px-3 py-2 max-w-xs truncate">{f.institucion ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{f.fecha_emision}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCLP(f.monto)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${f.dias > 60 ? 'text-red-600' : 'text-amber-600'}`}>
                          {f.dias}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sinCalzar.length === 0 && vencidas.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">Todo calzado ✓</p>
          )}
        </div>
      )}
    </div>
  )
}

function TablaCalces({
  rows,
  onConfirmar,
}: {
  rows: Conciliacion[]
  onConfirmar?: () => void
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  async function confirmarUno(id: string) {
    setConfirmando(id)
    await fetch('/api/conciliacion/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setConfirmando(null)
    onConfirmar?.()
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">Sin resultados</p>
  }

  return (
    <div className="rounded border overflow-hidden text-sm">
      <table className="w-full">
        <thead className="bg-zinc-50 dark:bg-zinc-800 text-left">
          <tr>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Descripción abono</th>
            <th className="px-3 py-2 text-right">Abono</th>
            <th className="px-3 py-2">Factura(s)</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} className="border-t hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <td className="px-3 py-2 whitespace-nowrap">
                {c.movimientos_bancarios?.fecha ?? '—'}
              </td>
              <td className="px-3 py-2 max-w-xs truncate">
                {c.movimientos_bancarios?.descripcion ?? '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {c.movimientos_bancarios?.abono != null
                  ? '$' + Number(c.movimientos_bancarios.abono).toLocaleString('es-CL')
                  : '—'}
              </td>
              <td className="px-3 py-2">
                {c.facturas ? `N° ${c.facturas.numero}` : '—'}
              </td>
              <td className="px-3 py-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                  ${c.tipo === 'factoring' ? 'bg-purple-100 text-purple-700' :
                    c.tipo === 'agrupado'  ? 'bg-blue-100 text-blue-700' :
                    'bg-zinc-100 text-zinc-700'}`}>
                  {c.tipo}
                </span>
              </td>
              <td className="px-3 py-2">
                {c.confirmado_por ? (
                  <span className="text-green-600 text-xs">✓ Confirmado</span>
                ) : onConfirmar ? (
                  <button
                    onClick={() => confirmarUno(c.id)}
                    disabled={confirmando === c.id}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {confirmando === c.id ? '…' : 'Confirmar'}
                  </button>
                ) : (
                  <span className="text-amber-600 text-xs">Pendiente</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
