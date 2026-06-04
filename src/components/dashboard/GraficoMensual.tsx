'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { type LicitacionConAlerta } from '@/types'
import { subDays, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'America/Santiago'

interface GraficoMensualProps {
  licitaciones: LicitacionConAlerta[]
}

export function GraficoMensual({ licitaciones }: GraficoMensualProps) {
  const datos = useMemo(() => {
    const hoy = toZonedTime(new Date(), TZ)
    const semanas: { semana: string; cotizadas: number; ganadas: number }[] = []

    // Agrupa por semana los últimos 30 días (4 semanas)
    for (let i = 3; i >= 0; i--) {
      const inicio = startOfDay(subDays(hoy, (i + 1) * 7))
      const fin = startOfDay(subDays(hoy, i * 7))
      const label = format(inicio, 'dd MMM', { locale: es })

      const enRango = licitaciones.filter(l => {
        const cierre = toZonedTime(new Date(l.fecha_cierre_1), TZ)
        return cierre >= inicio && cierre < fin
      })

      semanas.push({
        semana: label,
        cotizadas: enRango.filter(l => l.estado === 'enviada' || l.resultado !== null).length,
        ganadas: enRango.filter(l => l.resultado === 'ganada').length,
      })
    }
    return semanas
  }, [licitaciones])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Cotizadas vs Ganadas — últimos 30 días
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={datos} barGap={4}>
          <XAxis dataKey="semana" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cotizadas" name="Cotizadas" fill="#93C5FD" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ganadas" name="Ganadas" fill="#4ADE80" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
