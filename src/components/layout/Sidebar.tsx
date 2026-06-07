'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, List, Calendar, BarChart2,
  Settings, LogOut, Upload, RefreshCw, MoreHorizontal,
  Building2, X, Search, Command
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

  const inicial = perfil ? (perfil.nombre ?? perfil.email).charAt(0).toUpperCase() : 'U'

  return (
    <>
      {/* ── Sidebar desktop (md+) ── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-slate-900 flex-col min-h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Chilecompra2</div>
              <div className="text-xs text-slate-400">Licitaciones públicas</div>
            </div>
          </div>
        </div>

        {/* Cmd+K búsqueda */}
        <div className="px-3 py-3 border-b border-slate-700/50">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
            className="flex items-center gap-2 w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-slate-400 text-xs transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Buscar licitación...</span>
            <span className="flex items-center gap-0.5 text-slate-500">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </button>
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activo
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', activo ? 'text-blue-400' : 'text-slate-500')} />
                {label}
              </Link>
            )
          })}

          {perfil?.rol === 'admin' && (
            <div className="pt-3 mt-3 border-t border-slate-700/50 space-y-0.5">
              <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</p>
              <Link href="/config" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all', pathname === '/config' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                <Settings className="h-4 w-4 flex-shrink-0 text-slate-500" />
                Configuración
              </Link>
              <Link href="/config/importar" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all', pathname === '/config/importar' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                <Upload className="h-4 w-4 flex-shrink-0 text-slate-500" />
                Importar Excel
              </Link>
              <Link href="/config/sincronizar" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all', pathname === '/config/sincronizar' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                <RefreshCw className="h-4 w-4 flex-shrink-0 text-slate-500" />
                Mercado Público
              </Link>
            </div>
          )}
        </nav>

        {/* Footer usuario */}
        <div className="px-3 py-4 border-t border-slate-700/50">
          {perfil && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg bg-slate-800/50">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 text-xs font-bold">{inicial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{perfil.nombre ?? perfil.email}</div>
                <div className="text-xs text-slate-500 capitalize">{perfil.rol}</div>
              </div>
            </div>
          )}
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Bottom nav móvil (< md) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 flex items-stretch safe-bottom">
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
            >
              <div className={cn(
                'flex items-center justify-center w-10 h-6 rounded-full transition-all',
                activo ? 'bg-blue-100' : ''
              )}>
                <Icon className={cn('h-5 w-5', activo ? 'text-blue-600' : 'text-gray-400')} />
              </div>
              <span className={cn('text-[10px] font-medium', activo ? 'text-blue-600' : 'text-gray-400')}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* Botón "Más" */}
        <button
          onClick={() => setMenuAbierto(v => !v)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        >
          <div className={cn(
            'flex items-center justify-center w-10 h-6 rounded-full transition-all',
            menuAbierto ? 'bg-blue-100' : ''
          )}>
            <MoreHorizontal className={cn('h-5 w-5', menuAbierto ? 'text-blue-600' : 'text-gray-400')} />
          </div>
          <span className={cn('text-[10px] font-medium', menuAbierto ? 'text-blue-600' : 'text-gray-400')}>
            Más
          </span>
        </button>
      </nav>

      {/* Panel "Más" en móvil */}
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setMenuAbierto(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl shadow-2xl px-4 pt-2 pb-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 text-sm font-bold">{inicial}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{perfil?.nombre ?? perfil?.email}</div>
                  <div className="text-xs text-gray-400 capitalize">{perfil?.rol}</div>
                </div>
              </div>
              <button onClick={() => setMenuAbierto(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {perfil?.rol === 'admin' && (
              <div className="space-y-1 mb-3">
                <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Administración</p>
                <Link href="/config" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-gray-600" />
                  </div>
                  Configuración
                </Link>
                <Link href="/config/importar" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-gray-600" />
                  </div>
                  Importar Excel
                </Link>
                <Link href="/config/sincronizar" onClick={() => setMenuAbierto(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-gray-600" />
                  </div>
                  Mercado Público
                </Link>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={cerrarSesion}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 font-medium"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
