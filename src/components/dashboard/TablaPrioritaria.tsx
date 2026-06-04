'use client'

import Link from 'next/link'
import { type LicitacionConAlerta } from '@/types'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { formatearTiempoRestante } from '@/lib/utils/categoria-alerta'
import { formatCLP } from '@/lib/utils/format'

interface TablaPrioritariaProps {
  licitaciones: LicitacionConAlerta[]
}

const CATEGORIAS_FINALES = new Set(['resultado_registrado', 'revisado', 'ok'])

export function TablaPrioritaria({ licitaciones }: TablaPrioritariaProps) {
  const top10 = [...licitaciones]
    .filter(l => !CATEGORIAS_FINALES.has(l.categoria_alerta_calc))
    .sort((a, b) => a.horas_restantes - b.horas_restantes)
    .slice(0, 10)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-left font-medium">Nombre</th>
            <th className="px-4 py-3 text-left font-medium">Institución</th>
            <th className="px-4 py-3 text-left font-medium">Cierre</th>
            <th className="px-4 py-3 text-left font-medium">Monto</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {top10.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                No hay licitaciones en esta categoría
              </td>
            </tr>
          )}
          {top10.map(l => (
            <tr key={l.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/licitaciones/${l.id}`}
                  className="font-mono text-blue-600 hover:underline text-xs"
                >
                  {l.codigo_chilecompra}
                </Link>
              </td>
              <td className="px-4 py-3 max-w-[200px]">
                <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-2">
                  {l.nombre}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">
                {l.institucion}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={l.horas_restantes < 24 && l.horas_restantes > 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                  {formatearTiempoRestante(l.horas_restantes)}
                </span>
                <div className="text-xs text-gray-400">
                  {new Date(l.fecha_cierre_1).toLocaleDateString('es-CL')}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                {l.monto_clp ? formatCLP(l.monto_clp) : '—'}
              </td>
              <td className="px-4 py-3">
                <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
