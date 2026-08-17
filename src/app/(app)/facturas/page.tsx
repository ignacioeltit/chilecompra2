'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useSupabase'
import { type Factura } from '@/types'
import { formatCLP } from '@/lib/utils/format'
import { Search, CheckCircle, Clock, XCircle, Loader2, Receipt } from 'lucide-react'

const METODOS_PAGO = [
  'Transferencia bancaria',
  'Confirming Banco Estado',
  'Cheque',
  'Efectivo',
  'Otro',
]

type FacturaConLic = Factura & {
  licitacion: {
    codigo_chilecompra: string
    nombre: string
    institucion: string
    monto_clp: number | null
  } | null
}

type Filtro = 'todas' | 'inpagas' | 'cobradas'

function diasCobro(fechaEmision: string): number {
  const vence = new Date(fechaEmision)
  vence.setDate(vence.getDate() + 30)
  return Math.ceil((vence.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const supabase = createClient()

export default function FacturasPage() {
  const { perfil } = useUser()
  const [facturas, setFacturas] = useState<FacturaConLic[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('inpagas')
  const [marcando, setMarcando] = useState<string | null>(null)
  const [metodoPagoSel, setMetodoPagoSel] = useState<Record<string, string>>({})
  const [fechaPagoSel, setFechaPagoSel] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!perfil?.org_id) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('facturas')
      .select(`
        *,
        licitacion:licitaciones(codigo_chilecompra, nombre, institucion, monto_clp)
      `)
      .eq('org_id', perfil.org_id)
      .order('fecha_emision', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }
    setFacturas((data as FacturaConLic[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void cargar() }, [perfil?.org_id])

  async function marcarPagada(id: string) {
    const metodo = metodoPagoSel[id] ?? ''
    const fecha  = fechaPagoSel[id] ?? new Date().toISOString().slice(0, 10)
    setMarcando(id)
    const { error: err } = await supabase
      .from('facturas')
      .update({ fecha_pago: fecha, metodo_pago: metodo || null })
      .eq('id', id)
    setMarcando(null)
    if (err) { setError('No se pudo marcar como pagada'); return }
    await cargar()
  }

  const filtradas = useMemo(() => {
    let lista = filtro === 'inpagas'
      ? facturas.filter(f => !f.fecha_pago)
      : filtro === 'cobradas'
      ? facturas.filter(f => f.fecha_pago)
      : facturas

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter(f =>
        f.numero.toLowerCase().includes(q) ||
        f.licitacion?.codigo_chilecompra.toLowerCase().includes(q) ||
        f.licitacion?.institucion.toLowerCase().includes(q) ||
        f.licitacion?.nombre.toLowerCase().includes(q) ||
        String(f.monto).includes(q.replace(/\D/g, ''))
      )
    }
    return lista
  }, [facturas, filtro, busqueda])

  const nInpagas  = facturas.filter(f => !f.fecha_pago).length
  const nCobradas = facturas.filter(f =>  f.fecha_pago).length
  const totalInpago = facturas.filter(f => !f.fecha_pago).reduce((s, f) => s + f.monto, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 md:px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Receipt className="h-4 w-4 text-blue-400" />
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Cobros</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Facturas</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {nInpagas} sin cobrar · {formatCLP(totalInpago)} pendiente
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 -mt-4 pb-8 space-y-4">

        {/* Buscador + filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por monto, institución, N° factura o código licitación..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'inpagas',  label: `Sin cobrar (${nInpagas})`,   color: 'amber' },
              { key: 'cobradas', label: `Cobradas (${nCobradas})`,    color: 'green' },
              { key: 'todas',    label: `Todas (${facturas.length})`, color: 'gray'  },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === key
                    ? color === 'amber' ? 'bg-amber-100 text-amber-700 border border-amber-300'
                    : color === 'green' ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-200 text-gray-700 border border-gray-300'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex items-center justify-center gap-3 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando facturas...</span>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Receipt className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No se encontraron facturas</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filtradas.map(f => {
                const pagada = !!f.fecha_pago
                const dias   = !pagada ? diasCobro(f.fecha_emision) : null
                const vencida     = dias !== null && dias < 0
                const proxVencer  = dias !== null && dias >= 0 && dias <= 7

                return (
                  <div key={f.id} className={`p-4 ${vencida ? 'bg-red-50' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-bold text-gray-700">
                            Factura #{f.numero}
                          </span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCLP(f.monto)}
                          </span>
                          {pagada ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              <CheckCircle className="h-3 w-3" /> Cobrada
                            </span>
                          ) : vencida ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                              <XCircle className="h-3 w-3" /> Vencida hace {Math.abs(dias!)} día{Math.abs(dias!) !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              proxVencer ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
                            }`}>
                              <Clock className="h-3 w-3" />
                              {dias === 0 ? 'Vence hoy' : `${dias} día${dias !== 1 ? 's' : ''} para cobrar`}
                            </span>
                          )}
                        </div>

                        {f.licitacion && (
                          <Link href={`/licitaciones/${f.licitacion_id}`} className="group">
                            <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">
                              {f.licitacion.institucion}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {f.licitacion.codigo_chilecompra} · {f.licitacion.nombre}
                            </p>
                          </Link>
                        )}

                        <div className="mt-1 text-xs text-gray-400 flex gap-3 flex-wrap">
                          <span>Emitida: {new Date(f.fecha_emision).toLocaleDateString('es-CL')}</span>
                          {pagada && f.fecha_pago && (
                            <span className="text-green-600">
                              Pagada: {new Date(f.fecha_pago).toLocaleDateString('es-CL')}
                              {f.metodo_pago && ` · ${f.metodo_pago}`}
                            </span>
                          )}
                          {f.notas && <span className="italic text-amber-600">📝 {f.notas}</span>}
                        </div>
                      </div>

                      {/* Acción marcar pagada */}
                      {!pagada && (
                        <div className="flex flex-col gap-2 sm:items-end shrink-0 sm:min-w-[220px]">
                          <input
                            type="date"
                            value={fechaPagoSel[f.id] ?? new Date().toISOString().slice(0, 10)}
                            onChange={e => setFechaPagoSel(prev => ({ ...prev, [f.id]: e.target.value }))}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-auto"
                          />
                          <select
                            value={metodoPagoSel[f.id] ?? ''}
                            onChange={e => setMetodoPagoSel(prev => ({ ...prev, [f.id]: e.target.value }))}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-auto bg-white"
                          >
                            <option value="">Método de pago (opcional)</option>
                            {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <button
                            onClick={() => marcarPagada(f.id)}
                            disabled={marcando === f.id}
                            className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto"
                          >
                            {marcando === f.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle className="h-3 w-3" />}
                            Marcar cobrada
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
