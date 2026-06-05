'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, List, Calendar, BarChart2,
  Settings, LogOut, ChevronRight, Upload, RefreshCw, MoreHorizontal
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@/hooks/useSupabase'
import { useState } from 'react'

const supabase = createClient()

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/licitaciones', label: 'Licitaciones', icon: List },
  { href: '/calendario',   label: 'Calendario',   icon: Calendar },
  { href: '/reportes',     label: 'Reportes',     icon: BarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { perfil } = useUser()
  const [menuAbierto, setMenuAbierto] = useState(false)

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Sidebar desktop (md+) ── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-gray-200 flex-col min-h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">Chilecompra2</div>
              <div className="text-xs text-gray-400">Licitaciones</div>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  activo ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', activo ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                {label}
                {activo && <ChevronRight className="ml-auto h-3 w-3 text-blue-400" />}
              </Link>
            )
          })}

          {perfil?.rol === 'admin' && (
            <>
              <Link href="/config" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group', pathname === '/config' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                <Settings className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                Configuración
              </Link>
              <Link href="/config/importar" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group', pathname === '/config/importar' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                <Upload className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                Importar Excel
              </Link>
              <Link href="/config/sincronizar" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group', pathname === '/config/sincronizar' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                <RefreshCw className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                Mercado Público
              </Link>
            </>
          )}
        </nav>

        {/* Footer usuario */}
        <div className="px-3 py-4 border-t border-gray-100">
          {perfil && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-xs font-semibold uppercase">
                  {(perfil.nombre ?? perfil.email).charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{perfil.nombre ?? perfil.email}</div>
                <div className="text-xs text-gray-400 capitalize">{perfil.rol}</div>
              </div>
            </div>
          )}
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Bottom nav móvil (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-stretch">
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                activo ? 'text-blue-600' : 'text-gray-400'
              )}
            >
              <Icon className={cn('h-5 w-5', activo ? 'text-blue-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}

        {/* Botón "Más" para admin */}
        <button
          onClick={() => setMenuAbierto(v => !v)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
            menuAbierto ? 'text-blue-600' : 'text-gray-400'
          )}
        >
          <MoreHorizontal className={cn('h-5 w-5', menuAbierto ? 'text-blue-600' : 'text-gray-400')} />
          Más
        </button>
      </nav>

      {/* Panel "Más" en móvil */}
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMenuAbierto(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg rounded-t-2xl px-4 py-4 space-y-1"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-xs font-semibold uppercase">
                  {perfil ? (perfil.nombre ?? perfil.email).charAt(0) : 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{perfil?.nombre ?? perfil?.email}</div>
                <div className="text-xs text-gray-400 capitalize">{perfil?.rol}</div>
              </div>
            </div>

            {perfil?.rol === 'admin' && (
              <>
                <Link href="/config" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                  <Settings className="h-5 w-5 text-gray-400" /> Configuración
                </Link>
                <Link href="/config/importar" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                  <Upload className="h-5 w-5 text-gray-400" /> Importar Excel
                </Link>
                <Link href="/config/sincronizar" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                  <RefreshCw className="h-5 w-5 text-gray-400" /> Mercado Público
                </Link>
              </>
            )}

            <button
              onClick={cerrarSesion}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  )
}
