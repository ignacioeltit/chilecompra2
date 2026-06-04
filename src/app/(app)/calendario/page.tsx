'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek, isToday, isSameMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { type LicitacionConAlerta, ALERTAS } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { formatFechaHora } from '@/lib/utils/format'

const TZ = 'America/Santiago'

export default function CalendarioPage() {
  const { perfil } = useUser()
  const { licitaciones, loading } = useRealtimeLicitaciones(perfil?.org_id ?? '')
  const [mes, setMes] = useState(() => toZonedTime(new Date(), TZ))
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null)

  // Días visibles en la cuadrícula (semana completa inicio/fin del mes)
  const diasCuadricula = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 })
    const fin = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: inicio, end: fin })
  }, [mes])

  // Mapa día → licitaciones que cierran ese día
  const licsPorDia = useMemo(() => {
    const mapa = new Map<string, LicitacionConAlerta[]>()
    for (const l of licitaciones) {
      const fechaCierre = toZonedTime(new Date(l.fecha_cierre_1), TZ)
      const clave = format(fechaCierre, 'yyyy-MM-dd')
      const arr = mapa.get(clave) ?? []
      arr.push(l)
      mapa.set(clave, arr)
    }
    return mapa
  }, [licitaciones])

  const licsDelDia = diaSeleccionado
    ? (licsPorDia.get(format(diaSeleccionado, 'yyyy-MM-dd')) ?? [])
    : []

  const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Calendario</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMes(subMonths(mes, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-semibold text-gray-800 min-w-[140px] text-center capitalize">
              {format(mes, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setMes(addMonths(mes, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMes(toZonedTime(new Date(), TZ))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Cuadrícula calendario */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Cabecera días semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Cuadrícula */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {diasCuadricula.map(dia => {
              const clave = format(dia, 'yyyy-MM-dd')
              const lics = licsPorDia.get(clave) ?? []
              const esHoy = isToday(dia)
              const esMesActual = isSameMonth(dia, mes)
              const seleccionado = diaSeleccionado ? isSameDay(dia, diaSeleccionado) : false

              return (
                <button
                  key={clave}
                  onClick={() => setDiaSeleccionado(seleccionado ? null : dia)}
                  className={[
                    'bg-white min-h-[90px] p-2 text-left flex flex-col gap-1 transition-colors hover:bg-blue-50',
                    !esMesActual ? 'opacity-40' : '',
                    seleccionado ? 'ring-2 ring-inset ring-blue-500' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={[
                    'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                    esHoy ? 'bg-blue-600 text-white' : 'text-gray-700',
                  ].join(' ')}>
                    {format(dia, 'd')}
                  </span>

                  {/* Eventos (max 3 visibles) */}
                  {lics.slice(0, 3).map(l => {
                    const cfg = ALERTAS[l.categoria_alerta_calc]
                    return (
                      <span
                        key={l.id}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded truncate w-full block"
                        style={{ backgroundColor: cfg.color, color: cfg.textColor }}
                        title={l.nombre}
                      >
                        {l.codigo_chilecompra}
                      </span>
                    )
                  })}
                  {lics.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{lics.length - 3} más</span>
                  )}
                </button>
              )
            })}
          </div>

          {loading && (
            <p className="text-center text-sm text-gray-400 mt-4">Cargando licitaciones...</p>
          )}
        </div>

        {/* Sidebar detalle del día */}
        {diaSeleccionado && (
          <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 capitalize">
                {format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es })}
              </h2>
              <button
                onClick={() => setDiaSeleccionado(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {licsDelDia.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  Sin licitaciones este día
                </p>
              )}
              {licsDelDia.map(l => (
                <Link
                  key={l.id}
                  href={`/licitaciones/${l.id}`}
                  className="block rounded-xl border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs text-blue-600">{l.codigo_chilecompra}</span>
                    <BadgeAlerta categoria={l.categoria_alerta_calc} size="sm" />
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2 mb-1">{l.nombre}</p>
                  <p className="text-xs text-gray-400">{l.institucion}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Cierra: {formatFechaHora(l.fecha_cierre_1).split(' ')[1]}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
