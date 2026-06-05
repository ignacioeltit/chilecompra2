'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Download, Filter, Trash } from 'lucide-react'
import { type LicitacionConAlerta, type EstadoLicitacion, type CategoriaAlerta, ESTADOS_LICITACION, ALERTAS } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { formatCLP, formatFecha } from '@/lib/utils/format'
import { exportarExcel } from '@/lib/utils/export'

export default function LicitacionesPage() {
  const { perfil } = useUser()
  const { licitaciones, loading, recargar } = useRealtimeLicitaciones(perfil?.org_id ?? '')

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoLicitacion | ''>('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaAlerta | ''>('')
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [pagina, setPagina] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const POR_PAGINA = 50

  const filtradas = useMemo(() => {
    let resultado = licitaciones

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      resultado = resultado.filter(l =>
        l.nombre.toLowerCase().includes(q) ||
        l.codigo_chilecompra.toLowerCase().includes(q) ||
        l.institucion.toLowerCase().includes(q)
      )
    }

    if (filtroEstado) {
      resultado = resultado.filter(l => l.estado === filtroEstado)
    }

    if (filtroCategoria) {
      resultado = resultado.filter(l => l.categoria_alerta_calc === filtroCategoria)
    }

    return resultado
  }, [licitaciones, busqueda, filtroEstado, filtroCategoria])

  const paginas = Math.ceil(filtradas.length / POR_PAGINA)
  const pagActual = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  function toggleSeleccion(id: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodas() {
    if (seleccionadas.size === pagActual.length) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(pagActual.map(l => l.id)))
    }
  }

  async function handleExportar() {
    const datos = seleccionadas.size > 0
      ? filtradas.filter(l => seleccionadas.has(l.id))
      : filtradas
    await exportarExcel(datos)
  }

  async function handleDeleteSelected() {
    if (seleccionadas.size === 0) return
    const confirmar = window.confirm(`Eliminar ${seleccionadas.size} licitación(es) seleccionadas? Esta acción no se puede deshacer.`)
    if (!confirmar) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const codigos = Array.from(seleccionadas).map(id => {
        const lic = licitaciones.find(l => l.id === id)
        return lic?.codigo_chilecompra ?? null
      }).filter(Boolean) as string[]
      if (codigos.length === 0) {
        setDeleteError('No se encontraron códigos para las licitaciones seleccionadas')
        setDeleting(false)
        return
      }
      const res = await fetch('/api/import/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigos }),
      })
      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json?.error ?? 'Error al eliminar')
      } else {
        // limpiar selección y recargar
        setSeleccionadas(new Set())
        if (typeof recargar === 'function') await recargar()
      }
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        {/* Fila 1: título + botón nueva */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Licitaciones</h1>
          <div className="flex items-center gap-2">
            <button onClick={handleExportar} className="p-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors" title="Exportar">
              <Download className="h-4 w-4" />
            </button>
            {seleccionadas.size > 0 && (
              <button onClick={handleDeleteSelected} disabled={deleting} className="p-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar seleccionadas">
                <Trash className="h-4 w-4" />
              </button>
            )}
            <Link href="/licitaciones/nueva" className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4" />
              Nueva
            </Link>
          </div>
        </div>
        {/* Fila 2: buscador + filtros inline */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={e => { setFiltroEstado(e.target.value as EstadoLicitacion | ''); setPagina(1) }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[120px]"
          >
            <option value="">Estado</option>
            {Object.entries(ESTADOS_LICITACION).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroCategoria}
            onChange={e => { setFiltroCategoria(e.target.value as CategoriaAlerta | ''); setPagina(1) }}
            className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[110px]"
          >
            <option value="">Alerta</option>
            {(Object.entries(ALERTAS) as [CategoriaAlerta, typeof ALERTAS[CategoriaAlerta]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {(filtroEstado || filtroCategoria || busqueda) && (
          <button onClick={() => { setFiltroEstado(''); setFiltroCategoria(''); setBusqueda(''); setPagina(1) }} className="text-xs text-blue-600 mt-2">
            Limpiar filtros · {filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Vista móvil: cards ── */}
      <div className="md:hidden px-4 py-3 space-y-2">
        {loading && <p className="text-center text-gray-400 py-8 text-sm">Cargando...</p>}
        {!loading && pagActual.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">No hay licitaciones que coincidan</p>
        )}
        {pagActual.map(l => (
          <Link key={l.id} href={`/licitaciones/${l.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-mono text-xs text-blue-600">{l.codigo_chilecompra}</span>
              <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{l.nombre}</p>
            <p className="text-xs text-gray-500 truncate mb-2">{l.institucion}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600' : 'text-gray-500'}`}>
                {formatearTiempoRestante(l.horas_restantes)} · {formatFecha(l.fecha_cierre_1)}
              </span>
              {l.monto_clp && <span className="text-xs text-gray-600 font-medium">{formatCLP(l.monto_clp)}</span>}
            </div>
          </Link>
        ))}
        {paginas > 1 && (
          <div className="flex justify-between pt-2">
            <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40">Anterior</button>
            <span className="text-xs text-gray-500 self-center">Pág. {pagina} / {paginas}</span>
            <button disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </div>

      {/* ── Vista desktop: tabla + filtros laterales ── */}
      <div className="hidden md:flex">
        <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 min-h-screen p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Estado</label>
              <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value as EstadoLicitacion | ''); setPagina(1) }} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                {Object.entries(ESTADOS_LICITACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Alerta</label>
              <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value as CategoriaAlerta | ''); setPagina(1) }} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {(Object.entries(ALERTAS) as [CategoriaAlerta, typeof ALERTAS[CategoriaAlerta]][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {(filtroEstado || filtroCategoria || busqueda) && (
              <button onClick={() => { setFiltroEstado(''); setFiltroCategoria(''); setBusqueda(''); setPagina(1) }} className="text-sm text-blue-600 hover:underline">Limpiar filtros</button>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}</p>
          </div>
        </aside>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={seleccionadas.size === pagActual.length && pagActual.length > 0} onChange={toggleTodas} className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Institución</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cierre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Monto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>}
                {!loading && pagActual.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay licitaciones que coincidan con los filtros</td></tr>}
                {pagActual.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={seleccionadas.has(l.id)} onChange={() => toggleSeleccion(l.id)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3"><Link href={`/licitaciones/${l.id}`} className="font-mono text-blue-600 hover:underline text-xs whitespace-nowrap">{l.codigo_chilecompra}</Link></td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-2 text-sm font-medium">{l.nombre}</Link>
                      {l.descripcion && <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{l.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{l.institucion}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{formatearTiempoRestante(l.horas_restantes)}</div>
                      <div className="text-xs text-gray-400">{formatFecha(l.fecha_cierre_1)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{l.monto_clp ? formatCLP(l.monto_clp) : '—'}</td>
                    <td className="px-4 py-3"><BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-sm text-gray-500">Pág. {pagina} de {paginas} — {filtradas.length} resultados</span>
                <div className="flex gap-2">
                  <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">Anterior</button>
                  <button disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
