'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Download } from 'lucide-react'
import { subMonths, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { type LicitacionConAlerta } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { formatCLP } from '@/lib/utils/format'

const TZ = 'America/Santiago'
const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4']

export default function ReportesPage() {
  const { perfil } = useUser()
  const { licitaciones, loading } = useRealtimeLicitaciones(perfil?.org_id ?? '')
  const [rango, setRango] = useState<3 | 6 | 12>(6)

  const ahora = toZonedTime(new Date(), TZ)

  // ── Meses del rango seleccionado ──
  const meses = useMemo(() => {
    const inicio = startOfMonth(subMonths(ahora, rango - 1))
    return eachMonthOfInterval({ start: inicio, end: startOfMonth(ahora) })
  }, [rango, ahora])

  // ── Tasa de adjudicación por mes ──
  const datosAdjudicacion = useMemo(() => {
    return meses.map(mes => {
      const inicio = startOfMonth(mes)
      const fin    = endOfMonth(mes)
      const delMes = licitaciones.filter(l => {
        const cierre = toZonedTime(new Date(l.fecha_cierre_1), TZ)
        return cierre >= inicio && cierre <= fin
      })
      const enviadas = delMes.filter(l => l.estado === 'enviada' || l.resultado !== null)
      const ganadas  = delMes.filter(l => l.resultado === 'ganada')
      const tasa = enviadas.length > 0 ? Math.round((ganadas.length / enviadas.length) * 100) : 0
      return {
        mes: format(mes, 'MMM yy', { locale: es }),
        enviadas: enviadas.length,
        ganadas:  ganadas.length,
        tasa,
      }
    })
  }, [meses, licitaciones])

  // ── Montos cotizados vs adjudicados ──
  const datosMontos = useMemo(() => {
    return meses.map(mes => {
      const inicio = startOfMonth(mes)
      const fin    = endOfMonth(mes)
      const delMes = licitaciones.filter(l => {
        const cierre = toZonedTime(new Date(l.fecha_cierre_1), TZ)
        return cierre >= inicio && cierre <= fin && l.monto_clp
      })
      return {
        mes: format(mes, 'MMM yy', { locale: es }),
        cotizado:   delMes.reduce((s, l) => s + (l.monto_clp ?? 0), 0),
        adjudicado: delMes
          .filter(l => l.resultado === 'ganada')
          .reduce((s, l) => s + (l.monto_clp ?? 0), 0),
      }
    })
  }, [meses, licitaciones])

  // ── Ranking instituciones ──
  const rankingInstituciones = useMemo(() => {
    const inicio = startOfMonth(subMonths(ahora, rango - 1))
    const delRango = licitaciones.filter(l =>
      toZonedTime(new Date(l.fecha_cierre_1), TZ) >= inicio
    )
    const conteo: Record<string, { total: number; ganadas: number; monto: number }> = {}
    for (const l of delRango) {
      const key = l.institucion
      if (!conteo[key]) conteo[key] = { total: 0, ganadas: 0, monto: 0 }
      conteo[key].total++
      if (l.resultado === 'ganada') conteo[key].ganadas++
      conteo[key].monto += l.monto_clp ?? 0
    }
    return Object.entries(conteo)
      .map(([nombre, d]) => ({ nombre, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [licitaciones, rango, ahora])

  // ── Tiempo promedio publicación → cotización ──
  const tiempoPromedio = useMemo(() => {
    const conAmbas = licitaciones.filter(
      l => l.fecha_publicacion && (l.estado === 'enviada' || l.resultado !== null)
    )
    if (!conAmbas.length) return null
    const tiempos = conAmbas.map(l => {
      const pub = new Date(l.fecha_publicacion!).getTime()
      const cie = new Date(l.fecha_cierre_1).getTime()
      return (cie - pub) / (1000 * 60 * 60 * 24)
    })
    return Math.round(tiempos.reduce((s, t) => s + t, 0) / tiempos.length)
  }, [licitaciones])

  // ── KPIs ──
  const inicio = startOfMonth(subMonths(ahora, rango - 1))
  const delRango = licitaciones.filter(l =>
    toZonedTime(new Date(l.fecha_cierre_1), TZ) >= inicio
  )
  const kpis = {
    total:       delRango.length,
    enviadas:    delRango.filter(l => l.estado === 'enviada' || l.resultado !== null).length,
    ganadas:     delRango.filter(l => l.resultado === 'ganada').length,
    montoTotal:  delRango.reduce((s, l) => s + (l.monto_clp ?? 0), 0),
    montoGanado: delRango.filter(l => l.resultado === 'ganada').reduce((s, l) => s + (l.monto_clp ?? 0), 0),
  }
  const tasaAdj = kpis.enviadas > 0 ? Math.round((kpis.ganadas / kpis.enviadas) * 100) : 0

  async function exportarPDF() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
          <div className="flex items-center gap-3">
            {/* Selector de rango */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {([3, 6, 12] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setRango(m)}
                  className={[
                    'px-3 py-1.5 font-medium transition-colors',
                    rango === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {m}m
                </button>
              ))}
            </div>
            <button
              onClick={exportarPDF}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6" id="reporte-contenido">
        {loading && (
          <div className="text-center py-12 text-gray-400">Cargando datos...</div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Licitaciones',    valor: kpis.total,                      fmt: String },
            { label: 'Cotizadas',       valor: kpis.enviadas,                   fmt: String },
            { label: 'Ganadas',         valor: kpis.ganadas,                    fmt: String },
            { label: 'Tasa adj.',       valor: `${tasaAdj}%`,                   fmt: String },
            { label: 'Monto ganado',    valor: kpis.montoGanado,                fmt: formatCLP },
          ].map(({ label, valor, fmt }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-xl font-bold text-gray-900">
                {typeof valor === 'number' ? fmt(valor) : valor}
              </div>
            </div>
          ))}
        </div>

        {tiempoPromedio !== null && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">Tiempo promedio publicación → cotización: </span>
            <span className="font-bold text-gray-900">{tiempoPromedio} días</span>
          </div>
        )}

        {/* Gráfico tasa de adjudicación */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Tasa de adjudicación por mes (%)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={datosAdjudicacion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <Tooltip
                formatter={(v: number) => [`${v}%`, 'Tasa']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="tasa" name="Tasa adj. (%)"
                stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
              />
              <Line
                type="monotone" dataKey="enviadas" name="Cotizadas"
                stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 2"
              />
              <Line
                type="monotone" dataKey="ganadas" name="Ganadas"
                stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Montos cotizados vs adjudicados */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Monto cotizado vs adjudicado (CLP)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosMontos} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`}
              />
              <Tooltip
                formatter={(v: number) => [formatCLP(v)]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cotizado" name="Cotizado" fill="#93C5FD" radius={[4,4,0,0]} />
              <Bar dataKey="adjudicado" name="Adjudicado" fill="#4ADE80" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking instituciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Ranking de instituciones por volumen
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-left">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Institución</th>
                  <th className="pb-2 font-medium text-right">Licitaciones</th>
                  <th className="pb-2 font-medium text-right">Ganadas</th>
                  <th className="pb-2 font-medium text-right">Tasa</th>
                  <th className="pb-2 font-medium text-right">Monto total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rankingInstituciones.map((inst, i) => {
                  const tasa = inst.total > 0 ? Math.round((inst.ganadas / inst.total) * 100) : 0
                  return (
                    <tr key={inst.nombre} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="py-2.5 font-medium text-gray-800 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="truncate">{inst.nombre}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-gray-700">{inst.total}</td>
                      <td className="py-2.5 text-right text-green-600 font-medium">{inst.ganadas}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tasa >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {tasa}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-700">
                        {inst.monto ? formatCLP(inst.monto) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {rankingInstituciones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">Sin datos en el rango seleccionado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
