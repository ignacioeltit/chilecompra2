'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type LicitacionConAlerta } from '@/types'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { formatCLP } from '@/lib/utils/format'
import { Clock, StickyNote, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TablaPrioritariaProps {
  licitaciones: LicitacionConAlerta[]
  mostrarFinalizadas?: boolean
}

const CATEGORIAS_FINALES = new Set(['resultado_registrado', 'revisado', 'ok'])

export function TablaPrioritaria({ licitaciones, mostrarFinalizadas = false }: TablaPrioritariaProps) {
  const [editandoNota, setEditandoNota] = useState<string | null>(null)
  const [textoNota, setTextoNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorNota, setErrorNota] = useState<string | null>(null)

  const top10 = [...licitaciones]
    .filter(l => mostrarFinalizadas || !CATEGORIAS_FINALES.has(l.categoria_alerta_calc))
    .sort((a, b) => a.horas_restantes - b.horas_restantes)
    .slice(0, 10)

  function abrirNota(l: LicitacionConAlerta, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (editandoNota === l.id) {
      cancelar()
      return
    }
    setEditandoNota(l.id)
    setTextoNota(l.notas ?? '')
    setErrorNota(null)
  }

  async function guardar(id: string) {
    setGuardando(true)
    setErrorNota(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('licitaciones')
      .update({ notas: textoNota.trim() || null })
      .eq('id', id)
      .select('id')
    setGuardando(false)
    if (error || !data?.length) {
      setErrorNota('No se pudo guardar. Verifica tu sesión.')
      return
    }
    localStorage.setItem('dashboard_stale', '1')
    setEditandoNota(null)
  }

  function cancelar() {
    setEditandoNota(null)
    setTextoNota('')
    setErrorNota(null)
  }

  if (top10.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
        <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No hay licitaciones pendientes</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Vista móvil */}
      <div className="md:hidden divide-y divide-gray-50">
        {top10.map(l => (
          <div key={l.id}>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <Link href={`/licitaciones/${l.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-blue-600">{l.codigo_chilecompra}</span>
                  <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{l.nombre}</p>
                {l.notas && (
                  <p className="text-xs text-amber-600 truncate mt-0.5 italic">📝 {l.notas}</p>
                )}
              </Link>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className={`text-xs font-bold ${l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatearTiempoRestante(l.horas_restantes)}
                </div>
                {l.monto_clp && <div className="text-xs text-gray-400">{formatCLP(l.monto_clp)}</div>}
                <button
                  onClick={(e) => abrirNota(l, e)}
                  className={`p-1 rounded transition-colors ${l.notas ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-gray-500'}`}
                  title={l.notas ? 'Editar nota' : 'Agregar nota'}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Editor de nota móvil */}
            {editandoNota === l.id && (
              <div className="px-4 pb-3 bg-amber-50 border-t border-amber-100">
                <textarea
                  autoFocus
                  value={textoNota}
                  onChange={e => setTextoNota(e.target.value)}
                  placeholder="Escribe una nota rápida..."
                  rows={2}
                  className="w-full mt-2 text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none"
                />
                {errorNota && <p className="text-xs text-red-500 mt-1">{errorNota}</p>}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => guardar(l.id)}
                    disabled={guardando}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Guardar
                  </button>
                  <button
                    onClick={cancelar}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Institución</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cierre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Alerta</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {top10.map(l => (
              <>
                <tr key={l.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/licitaciones/${l.id}`} className="font-mono text-blue-600 hover:text-blue-800 text-xs font-semibold">
                      {l.codigo_chilecompra}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-2 font-medium text-gray-900">
                      {l.nombre}
                    </Link>
                    {l.notas && (
                      <p className="text-xs text-amber-600 truncate mt-0.5 italic max-w-[180px]">{l.notas}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate text-xs">{l.institucion}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${l.horas_restantes < 24 && l.horas_restantes > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatearTiempoRestante(l.horas_restantes)}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(l.fecha_cierre_1).toLocaleDateString('es-CL')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-sm font-medium">
                    {l.monto_clp ? formatCLP(l.monto_clp) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => abrirNota(l, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        editandoNota === l.id
                          ? 'bg-amber-100 text-amber-700'
                          : l.notas
                          ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-700'
                          : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                      }`}
                      title={l.notas ? 'Editar nota' : 'Agregar nota'}
                    >
                      <StickyNote className="h-4 w-4" />
                    </button>
                  </td>
                </tr>

                {/* Fila expandida para editar nota */}
                {editandoNota === l.id && (
                  <tr key={`nota-${l.id}`} className="bg-amber-50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <textarea
                          autoFocus
                          value={textoNota}
                          onChange={e => setTextoNota(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) guardar(l.id)
                            if (e.key === 'Escape') cancelar()
                          }}
                          placeholder="Escribe una nota rápida... (⌘+Enter para guardar)"
                          rows={2}
                          className="flex-1 text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none"
                        />
                        <div className="flex gap-1.5 pt-0.5">
                          <button
                            onClick={() => guardar(l.id)}
                            disabled={guardando}
                            className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Guardar
                          </button>
                          <button
                            onClick={cancelar}
                            className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {errorNota && <p className="text-xs text-red-500 mt-1">{errorNota}</p>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
