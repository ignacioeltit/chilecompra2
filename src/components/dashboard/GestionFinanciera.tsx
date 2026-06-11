'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type LicitacionConAlerta, type EstadoOC, ESTADOS_OC } from '@/types'
import { formatCLP } from '@/lib/utils/format'
import { CheckCircle, Clock, AlertCircle, DollarSign, ChevronDown } from 'lucide-react'

interface Props {
  licitaciones: LicitacionConAlerta[]
}

const PASOS: EstadoOC[] = ['emitida', 'aceptada', 'facturada', 'pagada']

export function GestionFinanciera({ licitaciones }: Props) {
  const [mostrarPagadas, setMostrarPagadas] = useState(false)
  const ganadas = licitaciones.filter(l => l.resultado === 'ganada')

  if (ganadas.length === 0) return null

  // Conteo y montos por estado OC
  const sinOC    = ganadas.filter(l => !l.estado_oc)
  const emitidas = ganadas.filter(l => l.estado_oc === 'emitida')
  const aceptadas= ganadas.filter(l => l.estado_oc === 'aceptada')
  const facturadas=ganadas.filter(l => l.estado_oc === 'facturada')
  const pagadas  = ganadas.filter(l => l.estado_oc === 'pagada')

  const pendienteCobro = [...sinOC, ...emitidas, ...aceptadas, ...facturadas]
  const totalPendiente = pendienteCobro.reduce((s, l) => s + (l.monto_clp ?? 0), 0)
  const totalCobrado   = pagadas.reduce((s, l) => s + (l.monto_clp ?? 0), 0)

  // Tabla: ganadas con acción pendiente (no pagadas), ordenadas por prioridad de estado
  const pendienteTabla = pendienteCobro
    .sort((a, b) => {
      const ord: Record<string, number> = { facturada: 0, aceptada: 1, emitida: 2, '': 3 }
      return (ord[a.estado_oc ?? ''] ?? 3) - (ord[b.estado_oc ?? ''] ?? 3)
    })
    .slice(0, 8)

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-3">Gestión financiera</h2>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Por cobrar</span>
          </div>
          <div className="text-xl font-bold text-green-800">
            {totalPendiente > 0 ? formatCLP(totalPendiente) : '—'}
          </div>
          <div className="text-xs text-green-600 mt-0.5">{pendienteCobro.length} licitacion{pendienteCobro.length !== 1 ? 'es' : ''}</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Cobrado</span>
          </div>
          <div className="text-xl font-bold text-blue-800">
            {totalCobrado > 0 ? formatCLP(totalCobrado) : '—'}
          </div>
          <div className="text-xs text-blue-600 mt-0.5">{pagadas.length} pagada{pagadas.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Sin OC aún</span>
          </div>
          <div className="text-2xl font-bold text-amber-800">{sinOC.length}</div>
          <div className="text-xs text-amber-600 mt-0.5">pendiente ingresar OC</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Factura pendiente</span>
          </div>
          <div className="text-2xl font-bold text-purple-800">{aceptadas.length + sinOC.length + emitidas.length}</div>
          <div className="text-xs text-purple-600 mt-0.5">sin factura emitida</div>
        </div>
      </div>

      {/* Tabla de pendientes */}
      {pendienteTabla.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Licitaciones ganadas pendientes de cobro</span>
            <Link href="/licitaciones" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Monto</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Estado OC</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Factura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendienteTabla.map(l => {
                const idxOC = l.estado_oc ? PASOS.indexOf(l.estado_oc) : -1
                const isPendFactura = idxOC < 2
                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/licitaciones/${l.id}`} className="font-mono text-blue-600 hover:underline text-xs whitespace-nowrap">
                        {l.codigo_chilecompra}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-1 text-gray-800">
                        {l.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      {l.monto_clp ? formatCLP(l.monto_clp) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.estado_oc ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          l.estado_oc === 'facturada' ? 'bg-blue-100 text-blue-700' :
                          l.estado_oc === 'aceptada'  ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {ESTADOS_OC[l.estado_oc]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin OC</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.numero_factura ? (
                        <span className="text-xs font-mono text-gray-700">#{l.numero_factura}</span>
                      ) : isPendFactura ? (
                        <span className="text-xs text-amber-600 font-medium">Pendiente</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de facturas pagadas */}
      {pagadas.length > 0 && (
        <div className="bg-white rounded-xl border border-green-200 overflow-hidden mt-3">
          <button
            onClick={() => setMostrarPagadas(v => !v)}
            className="w-full px-4 py-3 border-b border-green-100 flex items-center justify-between hover:bg-green-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Facturas pagadas ({pagadas.length})
              </span>
              <span className="text-sm font-bold text-green-700">{formatCLP(totalCobrado)}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-green-600 transition-transform ${mostrarPagadas ? 'rotate-180' : ''}`} />
          </button>

          {mostrarPagadas && (
            <table className="w-full text-sm">
              <thead className="bg-green-50/50 border-b border-green-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Código</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Nombre</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Monto</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">N° Factura</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Fecha pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pagadas.map(l => (
                  <tr key={l.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/licitaciones/${l.id}`} className="font-mono text-blue-600 hover:underline text-xs whitespace-nowrap">
                        {l.codigo_chilecompra}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link href={`/licitaciones/${l.id}`} className="hover:text-blue-600 line-clamp-1 text-gray-800">
                        {l.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      {l.monto_clp ? formatCLP(l.monto_clp) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.numero_factura
                        ? <span className="text-xs font-mono font-semibold text-green-700">#{l.numero_factura}</span>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                      {l.fecha_pago
                        ? new Date(l.fecha_pago).toLocaleDateString('es-CL')
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
