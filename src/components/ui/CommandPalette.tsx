'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Clock, AlertTriangle, FileCheck, X, ArrowRight, Command } from 'lucide-react'
import { ALERTAS } from '@/types'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { useLicitacionesStore } from './CommandPaletteProvider'

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function CommandPalette() {
  const { licitaciones } = useLicitacionesStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const resultados = query.trim().length < 1 ? [] : licitaciones
    .filter(l => {
      const q = query.toLowerCase()
      return (
        l.nombre.toLowerCase().includes(q) ||
        l.codigo_chilecompra.toLowerCase().includes(q) ||
        l.institucion.toLowerCase().includes(q)
      )
    })
    .slice(0, 8)

  const urgentes = query.trim().length < 1
    ? licitaciones.filter(l => l.categoria_alerta_calc === 'urgente').slice(0, 5)
    : []

  const items = query.trim().length < 1 ? urgentes : resultados

  const navegar = useCallback((id: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/licitaciones/${id}`)
  }, [router])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
        setQuery('')
        setCursor(0)
      }
      if (!open) return
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
      if (e.key === 'Enter' && items[cursor]) navegar(items[cursor].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, cursor, navegar])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); setQuery('') }} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar licitación, código, institución..."
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          <kbd className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 1 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                Cierres urgentes
              </p>
            </div>
          )}
          {query.trim().length >= 1 && resultados.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Search className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin resultados para <strong>"{query}"</strong></p>
            </div>
          )}
          {query.trim().length >= 1 && resultados.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {items.map((l, i) => {
            const config = ALERTAS[l.categoria_alerta_calc]
            const activo = cursor === i
            return (
              <button
                key={l.id}
                data-idx={i}
                onClick={() => navegar(l.id)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${activo ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: config.borderColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-blue-600 font-semibold">{l.codigo_chilecompra}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: config.color, color: config.textColor }}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{query ? highlight(l.nombre, query) : l.nombre}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{query ? highlight(l.institucion, query) : l.institucion}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 gap-1">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatearTiempoRestante(l.horas_restantes)}
                  </div>
                  {activo && <ArrowRight className="h-3.5 w-3.5 text-blue-400" />}
                </div>
              </button>
            )
          })}

          {items.length === 0 && query.trim().length < 1 && (
            <div className="px-4 py-8 text-center">
              <FileCheck className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No hay cierres urgentes</p>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 rounded px-1 bg-white">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 rounded px-1 bg-white">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="border border-gray-200 rounded px-1 bg-white">Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}

// Botón trigger móvil — abre la palette via evento de teclado
export function CommandPaletteTriggerMobile() {
  return (
    <button
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
      className="md:hidden fixed bottom-20 right-4 z-40 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center transition-all active:scale-95"
      title="Buscar (⌘K)"
    >
      <Search className="h-5 w-5" />
    </button>
  )
}
