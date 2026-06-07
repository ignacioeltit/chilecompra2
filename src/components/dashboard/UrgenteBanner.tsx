'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { type LicitacionConAlerta } from '@/types'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { formatCLP } from '@/lib/utils/format'

interface UrgenteBannerProps {
  licitaciones: LicitacionConAlerta[]
}

export function UrgenteBanner({ licitaciones }: UrgenteBannerProps) {
  const urgentes = licitaciones
    .filter(l => l.horas_restantes > 0 && l.horas_restantes <= 48 &&
      !['resultado_registrado', 'revisado', 'ok', 'no_participe', 'cancelada'].includes(l.categoria_alerta_calc))
    .sort((a, b) => a.horas_restantes - b.horas_restantes)

  if (urgentes.length === 0) return null

  const criticas = urgentes.filter(l => l.horas_restantes <= 24)
  const proximas = urgentes.filter(l => l.horas_restantes > 24)

  return (
    <div className="rounded-2xl overflow-hidden border border-red-200 shadow-sm">
      {/* Header */}
      <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">
            {urgentes.length} licitación{urgentes.length !== 1 ? 'es' : ''} cierran pronto
          </span>
        </div>
        <Link href="/licitaciones" className="text-red-200 hover:text-white text-xs font-medium transition-colors">
          Ver todas →
        </Link>
      </div>

      {/* Filas */}
      <div className="bg-white divide-y divide-red-50">
        {urgentes.slice(0, 5).map(l => {
          const esCritica = l.horas_restantes <= 24
          return (
            <Link
              key={l.id}
              href={`/licitaciones/${l.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors group"
            >
              {/* Indicador de urgencia */}
              <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${esCritica ? 'bg-red-100' : 'bg-orange-100'}`}>
                <Clock className={`h-4 w-4 ${esCritica ? 'text-red-600' : 'text-orange-500'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold ${esCritica ? 'text-red-700' : 'text-orange-600'}`}>
                    {formatearTiempoRestante(l.horas_restantes)}
                  </span>
                  <span className="font-mono text-xs text-gray-400">{l.codigo_chilecompra}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{l.nombre}</p>
                <p className="text-xs text-gray-400 truncate">{l.institucion}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {l.monto_clp && (
                  <span className="text-xs font-semibold text-gray-600 hidden sm:block">
                    {formatCLP(l.monto_clp)}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-red-400 transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>

      {urgentes.length > 5 && (
        <div className="bg-red-50 px-4 py-2 text-center">
          <Link href="/licitaciones" className="text-xs text-red-600 font-semibold hover:underline">
            Ver {urgentes.length - 5} más →
          </Link>
        </div>
      )}
    </div>
  )
}
