'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw } from 'lucide-react'
import { type CategoriaAlerta } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { ResumenCards } from '@/components/dashboard/ResumenCards'
import { TablaPrioritaria } from '@/components/dashboard/TablaPrioritaria'
import { GraficoMensual } from '@/components/dashboard/GraficoMensual'
import { TopInstituciones } from '@/components/dashboard/TopInstituciones'
import { GestionFinanciera } from '@/components/dashboard/GestionFinanciera'

export default function DashboardPage() {
  const { perfil, loading: loadingPerfil } = useUser()

  const orgId = perfil?.org_id ?? 'debf4e05-1c0a-445d-bac1-b3f2b60e0e2e'

  const { licitaciones, loading, error, recargar } =
    useRealtimeLicitaciones(orgId)

  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaAlerta[] | null>(null)
  const [filtroGanadas, setFiltroGanadas] = useState(false)

  const licsFiltradas = filtroGanadas
    ? licitaciones.filter(l => l.resultado === 'ganada')
    : filtroCategoria
    ? licitaciones.filter(l => filtroCategoria.includes(l.categoria_alerta_calc))
    : licitaciones

  if (loadingPerfil) {
    return (
      <div className="p-8 text-center text-gray-600">
        Cargando perfil...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Error al cargar: {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {licitaciones.length} licitaciones activas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={recargar}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/licitaciones/nueva"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva licitación</span>
              <span className="sm:hidden">Nueva</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Cards de resumen */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <ResumenCards
            licitaciones={licitaciones}
            filtroActivo={filtroCategoria}
            filtroGanadas={filtroGanadas}
            onFiltrar={setFiltroCategoria}
            onFiltrarGanadas={setFiltroGanadas}
          />
        )}

        {/* Filtro activo badge */}
        {(filtroCategoria || filtroGanadas) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Mostrando:</span>
            <span className="font-medium text-gray-800">
              {filtroGanadas ? 'Ganadas' : filtroCategoria!.map(c => c.replace(/_/g, ' ')).join(' + ')}
            </span>
            <button
              onClick={() => { setFiltroCategoria(null); setFiltroGanadas(false) }}
              className="text-blue-600 hover:underline"
            >
              Limpiar filtro
            </button>
          </div>
        )}

        {/* Tabla prioritaria */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              Próximos cierres
            </h2>
            <Link
              href="/licitaciones"
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <div className="h-40 rounded-xl bg-gray-200 animate-pulse" />
          ) : (
            <TablaPrioritaria licitaciones={licsFiltradas} />
          )}
        </div>

        {/* Gestión financiera */}
        {loading ? (
          <div className="h-48 rounded-xl bg-gray-200 animate-pulse" />
        ) : (
          <GestionFinanciera licitaciones={licitaciones} />
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <>
              <div className="h-60 rounded-xl bg-gray-200 animate-pulse" />
              <div className="h-60 rounded-xl bg-gray-200 animate-pulse" />
            </>
          ) : (
            <>
              <GraficoMensual licitaciones={licitaciones} />
              <TopInstituciones licitaciones={licitaciones} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
