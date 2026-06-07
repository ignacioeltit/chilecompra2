'use client'

import Link from 'next/link'
import { type LicitacionConAlerta } from '@/types'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { formatCLP } from '@/lib/utils/format'
import { Clock } from 'lucide-react'

interface TablaPrioritariaProps {
  licitaciones: LicitacionConAlerta[]
}

const CATEGORIAS_FINALES = new Set(['resultado_registrado', 'revisado', 'ok'])

export function TablaPrioritaria({ licitaciones }: TablaPrioritariaProps) {
  const top10 = [...licitaciones]
    .filter(l => !CATEGORIAS_FINALES.has(l.categoria_alerta_calc))
    .sort((a, b) => a.horas_restantes - b.horas_restantes)
    .slice(0, 10)

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
          <Link key={l.id} href={`/licitaciones/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs text-blue-600">{l.codigo_chilecompra}</span>
                <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{l.nombre}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-xs font-bold ${l.horas_restantes > 0 && l.horas_restantes <= 24 ? 'text-red-600' : 'text-gray-600'}`}>
                {formatearTiempoRestante(l.horas_restantes)}
              </div>
              {l.monto_clp && <div className="text-xs text-gray-400">{formatCLP(l.monto_clp)}</div>}
            </div>
          </Link>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {top10.map(l => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
