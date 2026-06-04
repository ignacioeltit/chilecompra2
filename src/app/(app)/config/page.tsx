'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, X, UserPlus, Bell, Building2, Wand2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type Usuario, type Institucion, type RolUsuario, ROLES_USUARIO } from '@/types'
import { useUser } from '@/hooks/useSupabase'
import { invitarUsuario, cambiarRol, eliminarUsuario, actualizarPreferencias } from '@/app/actions/usuarios'
import { crearInstitucion, actualizarInstitucion, eliminarInstitucion } from '@/app/actions/instituciones'
import { registrarSW } from '@/lib/utils/push'

type Tab = 'usuarios' | 'instituciones' | 'notificaciones'

export default function ConfigPage() {
  const { perfil } = useUser()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('usuarios')

  if (!perfil) return null
  if (perfil.rol !== 'admin') {
    return (
      <div className="p-8 text-center text-gray-500">
        Solo administradores pueden acceder a la configuración.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {([
            { id: 'usuarios',       label: 'Usuarios',      icon: UserPlus },
            { id: 'instituciones',  label: 'Instituciones', icon: Building2 },
            { id: 'notificaciones', label: 'Notificaciones',icon: Bell },
          ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {tab === 'usuarios' && <TabUsuarios perfil={perfil} />}
        {tab === 'instituciones' && <TabInstituciones perfil={perfil} />}
        {tab === 'notificaciones' && <TabNotificaciones perfil={perfil} />}
      </div>
    </div>
  )
}

// ── Tab Usuarios ──────────────────────────────────────────────
function TabUsuarios({ perfil }: { perfil: Usuario }) {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [emailInvitar, setEmailInvitar] = useState('')
  const [rolInvitar, setRolInvitar] = useState<RolUsuario>('editor')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('*')
      .eq('org_id', perfil.org_id)
      .order('creado_en')
      .then(({ data }) => setUsuarios(data ?? []))
  }, [perfil.org_id, supabase])

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const res = await invitarUsuario(emailInvitar, rolInvitar)
    if (res.error) setError(res.error)
    else {
      setEmailInvitar('')
      const { data } = await supabase.from('usuarios').select('*').eq('org_id', perfil.org_id).order('creado_en')
      setUsuarios(data ?? [])
    }
    setCargando(false)
  }

  async function cambiar(userId: string, rol: RolUsuario) {
    await cambiarRol(userId, rol)
    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, rol } : u))
  }

  async function eliminar(userId: string) {
    if (!confirm('¿Eliminar este usuario?')) return
    await eliminarUsuario(userId)
    setUsuarios(prev => prev.filter(u => u.id !== userId))
  }

  const ROLES: RolUsuario[] = ['admin', 'editor', 'lector']

  return (
    <div className="space-y-6">
      {/* Formulario invitación */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Invitar nuevo usuario</h3>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={invitar} className="flex gap-3">
          <input
            type="email"
            value={emailInvitar}
            onChange={e => setEmailInvitar(e.target.value)}
            placeholder="correo@empresa.cl"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={rolInvitar}
            onChange={e => setRolInvitar(e.target.value as RolUsuario)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="submit"
            disabled={cargando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {cargando ? 'Enviando...' : 'Invitar'}
          </button>
        </form>
      </div>

      {/* Lista usuarios */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Desde</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 text-xs font-semibold uppercase">
                        {(u.nombre ?? u.email).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{u.nombre ?? '—'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.id === perfil.id ? (
                    <span className="text-sm font-medium text-gray-700 capitalize">{u.rol}</span>
                  ) : (
                    <select
                      value={u.rol}
                      onChange={e => cambiar(u.id, e.target.value as RolUsuario)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(u.creado_en).toLocaleDateString('es-CL')}
                </td>
                <td className="px-4 py-3">
                  {u.id !== perfil.id && (
                    <button
                      onClick={() => eliminar(u.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab Instituciones ────────────────────────────────────────
function TabInstituciones({ perfil }: { perfil: Usuario }) {
  const supabase = createClient()
  const [instituciones, setInstituciones] = useState<Institucion[]>([])
  const [nombre, setNombre] = useState('')
  const [region, setRegion] = useState('')
  const [rut, setRut] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [completando, setCompletando] = useState(false)
  const [resultadoCompletar, setResultadoCompletar] = useState<{
    total: number; completadas: number; creadas: number
  } | null>(null)
  const [sinInstitucion, setSinInstitucion] = useState<{ id: string; codigo_chilecompra: string; nombre: string; institucion: string }[]>([])
  const [editandoInst, setEditandoInst] = useState<Record<string, string>>({})
  const [guardandoInst, setGuardandoInst] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('licitaciones')
      .select('id, codigo_chilecompra, nombre, institucion')
      .eq('org_id', perfil.org_id)
      .or('institucion.is.null,institucion.eq.,institucion.ilike.sin información,institucion.ilike.sin institucion,institucion.ilike.sin institución')
      .order('codigo_chilecompra')
      .then(({ data }) => setSinInstitucion(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.org_id])

  async function guardarInstitucion(licId: string) {
    const nombre = (editandoInst[licId] ?? '').trim()
    if (!nombre) return
    setGuardandoInst(licId)
    const { actualizarInstitucionLicitacion } = await import('@/app/actions/licitaciones')
    const res = await actualizarInstitucionLicitacion(licId, nombre)
    if (!res.error) setSinInstitucion(prev => prev.filter(l => l.id !== licId))
    setGuardandoInst(null)
  }

  async function completarInstituciones() {
    setCompletando(true)
    setResultadoCompletar(null)
    try {
      const res = await fetch('/api/instituciones/completar', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setResultadoCompletar(json)
        // Recargar lista de instituciones si se crearon nuevas
        if (json.creadas > 0) {
          const { data } = await supabase.from('instituciones').select('*').eq('org_id', perfil.org_id).order('nombre')
          setInstituciones(data ?? [])
        }
      }
    } finally {
      setCompletando(false)
    }
  }

  useEffect(() => {
    supabase
      .from('instituciones')
      .select('*')
      .eq('org_id', perfil.org_id)
      .order('nombre')
      .then(({ data }) => setInstituciones(data ?? []))
  }, [perfil.org_id, supabase])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    const res = await crearInstitucion(nombre, region, rut)
    if (!res.error) {
      const { data } = await supabase.from('instituciones').select('*').eq('org_id', perfil.org_id).order('nombre')
      setInstituciones(data ?? [])
      setNombre(''); setRegion(''); setRut('')
    }
  }

  async function guardarEdicion(id: string) {
    await actualizarInstitucion(id, editNombre)
    setInstituciones(prev => prev.map(i => i.id === id ? { ...i, nombre: editNombre } : i))
    setEditandoId(null)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta institución?')) return
    await eliminarInstitucion(id)
    setInstituciones(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Completar instituciones faltantes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-800">Licitaciones sin institución enlazada</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Detecta y enlaza automáticamente las licitaciones que tienen nombre de institución pero sin ID en el maestro.
          </p>
          {resultadoCompletar && (
            <p className="text-xs text-green-700 mt-1 font-medium">
              {resultadoCompletar.completadas}/{resultadoCompletar.total} licitaciones completadas
              {resultadoCompletar.creadas > 0 && ` · ${resultadoCompletar.creadas} institución(es) nueva(s) creada(s)`}
              {resultadoCompletar.completadas === 0 && resultadoCompletar.total === 0 && ' · Todo ya estaba enlazado'}
            </p>
          )}
        </div>
        <button
          onClick={completarInstituciones}
          disabled={completando}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {completando ? 'Completando...' : 'Completar instituciones'}
        </button>
      </div>

      {/* Licitaciones sin institución */}
      {sinInstitucion.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-800">
              {sinInstitucion.length} licitacion{sinInstitucion.length !== 1 ? 'es' : ''} sin institución válida
            </p>
            <p className="text-xs text-amber-600">Escribe el nombre correcto y presiona Enter o ✓</p>
          </div>
          <div className="divide-y divide-gray-100">
            {sinInstitucion.map(lic => (
              <div key={lic.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-blue-600">{lic.codigo_chilecompra}</p>
                  <p className="text-sm text-gray-700 truncate">{lic.nombre}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={editandoInst[lic.id] ?? lic.institucion ?? ''}
                    onChange={e => setEditandoInst(prev => ({ ...prev, [lic.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') guardarInstitucion(lic.id) }}
                    placeholder="Nombre de la institución..."
                    className="w-64 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => guardarInstitucion(lic.id)}
                    disabled={guardandoInst === lic.id || !(editandoInst[lic.id] ?? '').trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                  >
                    {guardandoInst === lic.id ? '...' : '✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Nueva institución</h3>
        <form onSubmit={agregar} className="flex gap-3">
          <input
            value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre de la institución" required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={region} onChange={e => setRegion(e.target.value)}
            placeholder="Región (opcional)"
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={rut} onChange={e => setRut(e.target.value)}
            placeholder="RUT (opcional)"
            className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Institución</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Región</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">RUT</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {instituciones.map(inst => (
              <tr key={inst.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {editandoId === inst.id ? (
                    <input
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      className="px-2 py-1 border border-blue-300 rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="font-medium text-gray-800">{inst.nombre}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{inst.region ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{inst.rut ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {editandoId === inst.id ? (
                      <>
                        <button onClick={() => guardarEdicion(inst.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditandoId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditandoId(inst.id); setEditNombre(inst.nombre) }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => eliminar(inst.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {instituciones.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin instituciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab Notificaciones ───────────────────────────────────────
function TabNotificaciones({ perfil }: { perfil: Usuario }) {
  const [prefs, setPrefs] = useState({
    notif_urgente:   perfil.notif_urgente,
    notif_pronto:    perfil.notif_pronto,
    notif_resultado: perfil.notif_resultado,
    notif_email:     perfil.notif_email,
  })
  const [pushActivo, setPushActivo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => setPushActivo(!!sub))
      )
    }
  }, [])

  async function activarPush() {
    const sub = await registrarSW()
    if (sub) {
      const { guardarSuscripcionPush } = await import('@/app/actions/usuarios')
      await guardarSuscripcionPush(sub.toJSON() as PushSubscriptionJSON)
      setPushActivo(true)
    }
  }

  async function guardar() {
    setGuardando(true)
    await actualizarPreferencias(prefs)
    setGuardando(false)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }

  const toggle = (key: keyof typeof prefs) =>
    setPrefs(p => ({ ...p, [key]: !p[key] }))

  const PREFS = [
    { key: 'notif_urgente',   label: 'Urgente',           desc: 'Push + email cuando una licitación cierra en <24h' },
    { key: 'notif_pronto',    label: 'Pronto',            desc: 'Email cuando una licitación cierra en 24-72h' },
    { key: 'notif_resultado', label: 'Revisar resultado', desc: 'Email cuando una licitación cerró sin registrar resultado' },
    { key: 'notif_email',     label: 'Email habilitado',  desc: 'Recibir notificaciones por correo electrónico' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Push notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Notificaciones push (móvil/escritorio)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Activa para recibir alertas incluso cuando la app no está abierta.
        </p>
        {pushActivo ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            <Check className="h-4 w-4" />
            Push activado en este dispositivo
          </div>
        ) : (
          <button
            onClick={activarPush}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Activar notificaciones push
          </button>
        )}
      </div>

      {/* Preferencias */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Qué quiero recibir</h3>
        <div className="space-y-4">
          {PREFS.map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-4 cursor-pointer group">
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => toggle(key)}
                className={[
                  'relative mt-0.5 flex-shrink-0 w-10 h-5 rounded-full transition-colors',
                  prefs[key] ? 'bg-blue-600' : 'bg-gray-300',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  prefs[key] ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')} />
              </button>
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar preferencias'}
          </button>
          {ok && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="h-4 w-4" />Guardado</span>}
        </div>
      </div>
    </div>
  )
}
