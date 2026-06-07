'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Download, Filter, Trash, ChevronRight, List, SlidersHorizontal } from 'lucide-react'
import { type LicitacionConAlerta, type EstadoLicitacion, type CategoriaAlerta, ESTADOS_LICITACION, ALERTAS } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { FiltroChips } from '@/components/ui/FiltroChips'
import { useSyncLicitaciones } from '@/hooks/useSyncLicitaciones'
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
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  useSyncLicitaciones(licitaciones)
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
        setSeleccionadas(new Set())
        if (typeof recargar === 'function') await recargar()
      }
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const hayFiltros = filtroEstado || filtroCategoria || busqueda

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <List className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Licitaciones</h1>
              {!loading && (
                <p className="text-xs text-gray-400">{filtradas.length} {hayFiltros ? 'resultados' : 'en total'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportar}
              className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              title="Exportar"
            >
              <Download className="h-4 w-4" />
            </button>
            {seleccionadas.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Eliminar seleccionadas"
              >
                <Trash className="h-4 w-4" />
              </button>
            )}
            <Link
              href="/licitaciones/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </Link>
          </div>
        </div>

        {/* Buscador + botón filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código o institución..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>
          <button
            onClick={() => setFiltrosAbiertos(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all ${
              hayFiltros
                ? 'bg-blue-600 text-white border-blue-600'
                : filtrosAbiertos
                ? 'bg-gray-100 text-gray-700 border-gray-200'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {hayFiltros && (
              <span className="w-4 h-4 bg-white text-blue-600 rounded-full text-xs font-bold flex items-center justify-center">
                {(filtroEstado ? 1 : 0) + (filtroCategoria ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Panel de chips desplegable */}
        {filtrosAbiertos && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <FiltroChips
              filtroEstado={filtroEstado}
              filtroCategoria={filtroCategoria}
              onEstado={v => { setFiltroEstado(v); setPagina(1) }}
              onCategoria={v => { setFiltroCategoria(v); setPagina(1) }}
            />
            {hayFiltros && (
              <button
                onClick={() => { setFiltroEstado(''); setFiltroCategoria(''); setBusqueda(''); setPagina(1) }}
                className="mt-3 text-xs text-blue-600 font-medium hover:underline"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}

        {deleteError && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>
        )}
      </div>

      {/* ── Vista móvil: cards ── */}
      <div className="md:hidden px-4 py-3 space-y-2">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white animate-pulse border border-gray-100" />
            ))}
          </div>
        )}
        {!loading && pagActual.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <List className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">No hay licitaciones que coincidan</p>
          </div>
        )}
        {pagActual.map(l => (
          <Link
            key={l.id}
            href={`/licitaciones/${l.id}`}
            className="block bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-blue-100 active:bg-gray-50 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-mono text-xs text-blue-600 font-semibold">{l.codigo_chilecompra}</span>
              <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
            </div>
            <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5">{l.nombre}</p>
            <p className="text-xs text-gray-400 truncate mb-3">{l.institucion}</p>
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <span className={`text-xs font-bold ${l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600' : 'text-gray-500'}`}>
                {formatearTiempoRestante(l.horas_restantes)}
                <span className="font-normal text-gray-400"> · {formatFecha(l.fecha_cierre_1)}</span>
              </span>
              <div className="flex items-center gap-1">
                {l.monto_clp && <span className="text-xs text-gray-600 font-semibold">{formatCLP(l.monto_clp)}</span>}
                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              </div>
            </div>
          </Link>
        ))}
        {paginas > 1 && (
          <div className="flex justify-between pt-2 pb-4">
            <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 font-medium">Anterior</button>
            <span className="text-xs text-gray-400 self-center">Pág. {pagina} / {paginas}</span>
            <button disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)} className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-40 font-medium">Siguiente</button>
          </div>
        )}
      </div>

      {/* ── Vista desktop: tabla + filtros laterales ── */}
      <div className="hidden md:flex">
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 min-h-screen p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Filter className="h-4 w-4 text-gray-400" />
              Filtros
            </div>
            {hayFiltros && (
              <button
                onClick={() => { setFiltroEstado(''); setFiltroCategoria(''); setBusqueda(''); setPagina(1) }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
          <FiltroChips
            filtroEstado={filtroEstado}
            filtroCategoria={filtroCategoria}
            onEstado={v => { setFiltroEstado(v); setPagina(1) }}
            onCategoria={v => { setFiltroCategoria(v); setPagina(1) }}
          />
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}</p>
          </div>
        </aside>

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={seleccionadas.size === pagActual.length && pagActual.length > 0} onChange={toggleTodas} className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Institución</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cierre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-400">Cargando...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && pagActual.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No hay licitaciones que coincidan con los filtros</td></tr>
                )}
                {pagActual.map(l => (
                  <tr key={l.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={seleccionadas.has(l.id)} onChange={() => toggleSeleccion(l.id)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3">
                      <Link href={`/licitaciones/${l.id}`} className="font-mono text-blue-600 hover:text-blue-800 text-xs font-bold whitespace-nowrap">
                        {l.codigo_chilecompra}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-2 font-medium text-gray-900">{l.nombre}</Link>
                      {l.descripcion && <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{l.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate text-xs">{l.institucion}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`font-semibold ${l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600' : 'text-gray-700'}`}>
                        {formatearTiempoRestante(l.horas_restantes)}
                      </div>
                      <div className="text-xs text-gray-400">{formatFecha(l.fecha_cierre_1)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                      {l.monto_clp ? formatCLP(l.monto_clp) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3"><BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Pág. {pagina} de {paginas} — {filtradas.length} resultados</span>
                <div className="flex gap-2">
                  <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium">Anterior</button>
                  <button disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
