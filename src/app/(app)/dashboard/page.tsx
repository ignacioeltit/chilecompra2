'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, TrendingUp } from 'lucide-react'
import { type CategoriaAlerta } from '@/types'
import { useRealtimeLicitaciones } from '@/hooks/useRealtimeLicitaciones'
import { useUser } from '@/hooks/useSupabase'
import { ResumenCards } from '@/components/dashboard/ResumenCards'
import { TablaPrioritaria } from '@/components/dashboard/TablaPrioritaria'
import { GraficoMensual } from '@/components/dashboard/GraficoMensual'
import { TopInstituciones } from '@/components/dashboard/TopInstituciones'
import { GestionFinanciera } from '@/components/dashboard/GestionFinanciera'
import { UrgenteBanner } from '@/components/dashboard/UrgenteBanner'
import { useSyncLicitaciones } from '@/hooks/useSyncLicitaciones'

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Error al cargar: {error}
        </div>
      </div>
    )
  }

  useSyncLicitaciones(licitaciones)

  const nombre = perfil?.nombre?.split(' ')[0] ?? 'Equipo'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 md:px-6 pt-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Dashboard</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                Hola, {nombre}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {loading ? '...' : `${licitaciones.length} licitaciones activas`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={recargar}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                title="Actualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <Link
                href="/licitaciones/nueva"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-500/25"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva licitación</span>
                <span className="sm:hidden">Nueva</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de resumen — superpuestas al header */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white animate-pulse shadow-sm border border-gray-100" />
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
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-5">
        {/* Banner urgente */}
        {!loading && <UrgenteBanner licitaciones={licitaciones} />}

        {/* Filtro activo badge */}
        {(filtroCategoria || filtroGanadas) && (
          <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <span className="text-blue-600 font-medium">
              Filtrando: {filtroGanadas ? 'Ganadas' : filtroCategoria!.map(c => c.replace(/_/g, ' ')).join(' + ')}
            </span>
            <button
              onClick={() => { setFiltroCategoria(null); setFiltroGanadas(false) }}
              className="ml-auto text-blue-500 hover:text-blue-700 text-xs font-semibold underline underline-offset-2"
            >
              Limpiar
            </button>
          </div>
        )}

        {/* Tabla prioritaria */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              Próximos cierres
            </h2>
            <Link
              href="/licitaciones"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <div className="h-40 rounded-2xl bg-white animate-pulse border border-gray-100 shadow-sm" />
          ) : (
            <TablaPrioritaria licitaciones={licsFiltradas} />
          )}
        </div>

        {/* Gestión financiera */}
        {loading ? (
          <div className="h-48 rounded-2xl bg-white animate-pulse border border-gray-100 shadow-sm" />
        ) : (
          <GestionFinanciera licitaciones={licitaciones} />
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <>
              <div className="h-60 rounded-2xl bg-white animate-pulse border border-gray-100 shadow-sm" />
              <div className="h-60 rounded-2xl bg-white animate-pulse border border-gray-100 shadow-sm" />
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
