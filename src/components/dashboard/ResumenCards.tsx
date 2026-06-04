'use client'

import { type CategoriaAlerta, ALERTAS, type LicitacionConAlerta } from '@/types'
import { cn } from '@/lib/utils/cn'

interface ResumenCardsProps {
  licitaciones: LicitacionConAlerta[]
  filtroActivo: CategoriaAlerta[] | null
  filtroGanadas: boolean
  onFiltrar: (cats: CategoriaAlerta[] | null) => void
  onFiltrarGanadas: (activo: boolean) => void
}

const CATEGORIAS_SIMPLES: CategoriaAlerta[] = [
  'urgente', 'pronto',
  'pendiente_revision',
  'cotizada', 'cerrada_sin_cotizar', 'sin_definir',
]

const COMBINADA = {
  categorias: ['revisar_resultado', 'revisado'] as CategoriaAlerta[],
  label: 'Resultado pendiente',
  color: '#CFE2F3',
  textColor: '#1E3A5F',
  borderColor: '#60A5FA',
}

export function ResumenCards({ licitaciones, filtroActivo, filtroGanadas, onFiltrar, onFiltrarGanadas }: ResumenCardsProps) {
  function toggle(cats: CategoriaAlerta[]) {
    const estaActivo = filtroActivo !== null &&
      cats.length === filtroActivo.length &&
      cats.every(c => filtroActivo.includes(c))
    onFiltrar(estaActivo ? null : cats)
    if (!estaActivo) onFiltrarGanadas(false)
  }

  function toggleGanadas() {
    const nuevo = !filtroGanadas
    onFiltrarGanadas(nuevo)
    if (nuevo) onFiltrar(null)
  }

  const nGanadas = licitaciones.filter(l => l.resultado === 'ganada').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Tarjetas por categoría de alerta */}
      {CATEGORIAS_SIMPLES.map(cat => {
        const config = ALERTAS[cat]
        const n = licitaciones.filter(l => l.categoria_alerta_calc === cat).length
        const activo = filtroActivo?.length === 1 && filtroActivo[0] === cat
        return (
          <button
            key={cat}
            onClick={() => toggle([cat])}
            className={cn(
              'rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none',
              activo ? 'ring-2 ring-offset-1 shadow-md' : 'hover:scale-[1.02]'
            )}
            style={{
              backgroundColor: config.color,
              borderColor: activo ? config.borderColor : 'transparent',
              color: config.textColor,
            }}
          >
            <div className="text-3xl font-bold">{n}</div>
            <div className="text-sm font-medium mt-1 leading-tight">{config.label}</div>
          </button>
        )
      })}

      {/* Resultado pendiente (revisar_resultado + revisado) */}
      {(() => {
        const n = licitaciones.filter(l =>
          COMBINADA.categorias.includes(l.categoria_alerta_calc)
        ).length
        const activo = filtroActivo !== null &&
          COMBINADA.categorias.length === filtroActivo.length &&
          COMBINADA.categorias.every(c => filtroActivo.includes(c))
        return (
          <button
            onClick={() => toggle(COMBINADA.categorias)}
            className={cn(
              'rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none',
              activo ? 'ring-2 ring-offset-1 shadow-md' : 'hover:scale-[1.02]'
            )}
            style={{
              backgroundColor: COMBINADA.color,
              borderColor: activo ? COMBINADA.borderColor : 'transparent',
              color: COMBINADA.textColor,
            }}
          >
            <div className="text-3xl font-bold">{n}</div>
            <div className="text-sm font-medium mt-1 leading-tight">{COMBINADA.label}</div>
          </button>
        )
      })()}

      {/* Ganadas */}
      <button
        onClick={toggleGanadas}
        className={cn(
          'rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none',
          filtroGanadas ? 'ring-2 ring-offset-1 shadow-md' : 'hover:scale-[1.02]'
        )}
        style={{
          backgroundColor: '#D9EAD3',
          borderColor: filtroGanadas ? '#4ADE80' : 'transparent',
          color: '#14532D',
        }}
      >
        <div className="text-3xl font-bold">{nGanadas}</div>
        <div className="text-sm font-medium mt-1 leading-tight">Ganadas</div>
      </button>
    </div>
  )
}
