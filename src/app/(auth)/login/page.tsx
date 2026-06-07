'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Building2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      })
      if (error) setError(error.message)
      else setSuccess('Revisa tu correo para confirmar tu cuenta.')
    }

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?mode=update-password`,
      })
      if (error) setError(error.message)
      else setSuccess('Revisa tu correo para restablecer tu contraseña.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Panel izquierdo — branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-slate-900 to-slate-800 border-r border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Chilecompra2</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestión de<br />licitaciones<br />
            <span className="text-blue-400">públicas</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Organiza, prioriza y da seguimiento a tus licitaciones de Mercado Público. Alertas automáticas de cierre, sincronización en tiempo real y gestión financiera integrada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {['A', 'B', 'C'].map(l => (
              <div key={l} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center">
                <span className="text-xs text-slate-300 font-semibold">{l}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs">Región de Ñuble</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Chilecompra2</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              {mode === 'login' && 'Bienvenido'}
              {mode === 'signup' && 'Crear cuenta'}
              {mode === 'reset' && 'Recuperar acceso'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {mode === 'login' && 'Ingresa con tu cuenta de organización'}
              {mode === 'signup' && 'Crea una cuenta nueva'}
              {mode === 'reset' && 'Te enviamos las instrucciones por correo'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
                placeholder="nombre@empresa.cl"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-4 py-3 pr-11 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' && 'Ingresar'}
              {mode === 'signup' && 'Crear cuenta'}
              {mode === 'reset' && 'Enviar instrucciones'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('reset')} className="text-slate-400 hover:text-blue-400 transition-colors block mx-auto">
                  ¿Olvidaste tu contraseña?
                </button>
                <p className="text-slate-500">
                  ¿Sin cuenta?{' '}
                  <button onClick={() => setMode('signup')} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Regístrate
                  </button>
                </p>
              </>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <button onClick={() => setMode('login')} className="text-slate-400 hover:text-blue-400 transition-colors">
                ← Volver al login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
