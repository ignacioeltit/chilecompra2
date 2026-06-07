'use client'

import { X } from 'lucide-react'
import { type EstadoLicitacion, type CategoriaAlerta, ESTADOS_LICITACION, ALERTAS } from '@/types'
import { cn } from '@/lib/utils/cn'

interface FiltroChipsProps {
  filtroEstado: EstadoLicitacion | ''
  filtroCategoria: CategoriaAlerta | ''
  onEstado: (v: EstadoLicitacion | '') => void
  onCategoria: (v: CategoriaAlerta | '') => void
}

const ESTADOS_ORDEN: EstadoLicitacion[] = [
  'sin_definir', 'revisar', 'pendiente_enviar', 'revisado', 'enviada', 'no_participe', 'cancelada'
]

const CATEGORIAS_ORDEN: CategoriaAlerta[] = [
  'urgente', 'pronto', 'pendiente_revision', 'cotizada', 'cerrada_sin_cotizar', 'revisar_resultado', 'sin_definir'
]

export function FiltroChips({ filtroEstado, filtroCategoria, onEstado, onCategoria }: FiltroChipsProps) {
  return (
    <div className="space-y-3">
      {/* Estado */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</p>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS_ORDEN.map(estado => {
            const activo = filtroEstado === estado
            return (
              <button
                key={estado}
                onClick={() => onEstado(activo ? '' : estado)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  activo
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                )}
              >
                {ESTADOS_LICITACION[estado]}
                {activo && <X className="h-3 w-3 ml-0.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Alerta */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Alerta</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS_ORDEN.map(cat => {
            const config = ALERTAS[cat]
            const activo = filtroCategoria === cat
            return (
              <button
                key={cat}
                onClick={() => onCategoria(activo ? '' : cat)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  activo ? 'shadow-sm scale-105' : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'
                )}
                style={activo ? {
                  backgroundColor: config.borderColor,
                  color: '#fff',
                  borderColor: config.borderColor,
                } : {
                  backgroundColor: config.color,
                  color: config.textColor,
                  borderColor: config.borderColor,
                }}
              >
                {config.label}
                {activo && <X className="h-3 w-3 ml-0.5" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
