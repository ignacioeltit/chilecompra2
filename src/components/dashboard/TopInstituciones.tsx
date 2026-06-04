'use client'

import { useMemo } from 'react'
import { type LicitacionConAlerta } from '@/types'

interface TopInstitucionesProps {
  licitaciones: LicitacionConAlerta[]
}

export function TopInstituciones({ licitaciones }: TopInstitucionesProps) {
  const top5 = useMemo(() => {
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recientes = licitaciones.filter(l => new Date(l.creado_en) >= hace30)

    const conteo: Record<string, number> = {}
    for (const l of recientes) {
      conteo[l.institucion] = (conteo[l.institucion] ?? 0) + 1
    }

    return Object.entries(conteo)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [licitaciones])

  const max = top5[0]?.[1] ?? 1

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Top instituciones (últimos 30 días)
      </h3>
      <div className="space-y-3">
        {top5.length === 0 && (
          <p className="text-sm text-gray-400">Sin datos aún</p>
        )}
        {top5.map(([nombre, n]) => (
          <div key={nombre}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 truncate max-w-[180px]">{nombre}</span>
              <span className="font-semibold text-gray-800 ml-2">{n}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
