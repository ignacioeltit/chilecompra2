'use client'

import { type CategoriaAlerta, ALERTAS, type LicitacionConAlerta } from '@/types'
import { cn } from '@/lib/utils/cn'
import { AlertTriangle, Clock, Eye, FileCheck, XCircle, HelpCircle, Trophy, CheckSquare } from 'lucide-react'

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

const CATEGORIA_ICONS: Partial<Record<CategoriaAlerta, React.ElementType>> = {
  urgente: AlertTriangle,
  pronto: Clock,
  pendiente_revision: Eye,
  cotizada: FileCheck,
  cerrada_sin_cotizar: XCircle,
  sin_definir: HelpCircle,
}

const COMBINADA = {
  categorias: ['revisar_resultado', 'revisado'] as CategoriaAlerta[],
  label: 'Resultado pendiente',
  color: '#EFF6FF',
  textColor: '#1E40AF',
  borderColor: '#93C5FD',
  bgAccent: '#DBEAFE',
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
      {CATEGORIAS_SIMPLES.map(cat => {
        const config = ALERTAS[cat]
        const n = licitaciones.filter(l => l.categoria_alerta_calc === cat).length
        const activo = filtroActivo?.length === 1 && filtroActivo[0] === cat
        const Icon = CATEGORIA_ICONS[cat] ?? HelpCircle
        return (
          <button
            key={cat}
            onClick={() => toggle([cat])}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:outline-none active:scale-95 bg-white shadow-sm',
              activo ? 'ring-2 ring-offset-1 shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'
            )}
            style={{
              borderColor: activo ? config.borderColor : '#F1F5F9',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: config.color }}
              >
                <Icon className="h-4 w-4" style={{ color: config.textColor }} />
              </div>
              {activo && (
                <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: config.borderColor }} />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 leading-none">{n}</div>
            <div className="text-xs font-medium mt-1.5 leading-tight" style={{ color: config.textColor }}>
              {config.label}
            </div>
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
              'rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:outline-none active:scale-95 bg-white shadow-sm',
              activo ? 'ring-2 ring-offset-1 shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'
            )}
            style={{ borderColor: activo ? COMBINADA.borderColor : '#F1F5F9' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COMBINADA.bgAccent }}>
                <CheckSquare className="h-4 w-4" style={{ color: COMBINADA.textColor }} />
              </div>
              {activo && <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: COMBINADA.borderColor }} />}
            </div>
            <div className="text-3xl font-bold text-gray-900 leading-none">{n}</div>
            <div className="text-xs font-medium mt-1.5 leading-tight" style={{ color: COMBINADA.textColor }}>
              {COMBINADA.label}
            </div>
          </button>
        )
      })()}

      {/* Ganadas */}
      <button
        onClick={toggleGanadas}
        className={cn(
          'rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:outline-none active:scale-95 bg-white shadow-sm',
          filtroGanadas ? 'ring-2 ring-offset-1 shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'
        )}
        style={{ borderColor: filtroGanadas ? '#4ADE80' : '#F1F5F9' }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100">
            <Trophy className="h-4 w-4 text-green-700" />
          </div>
          {filtroGanadas && <div className="w-2 h-2 rounded-full mt-1 bg-green-400" />}
        </div>
        <div className="text-3xl font-bold text-gray-900 leading-none">{nGanadas}</div>
        <div className="text-xs font-medium mt-1.5 leading-tight text-green-700">Ganadas</div>
      </button>
    </div>
  )
}
