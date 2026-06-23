'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, AlertCircle, Paperclip, Clock, Edit2, ExternalLink, Eye, XCircle, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type LicitacionConAlerta, type ResultadoLicitacion, RESULTADOS, ESTADOS_LICITACION } from '@/types'
import { calcularCategoriaAlerta } from '@/lib/utils/categoria-alerta'
import { BadgeAlerta } from '@/components/ui/badge-alerta'
import { actualizarInstitucionLicitacion } from '@/app/actions/licitaciones'
import { formatCLP, formatFechaHora, urlMercadoPublico } from '@/lib/utils/format'
import ReactMarkdown from 'react-markdown'

export default function DetalleLicitacionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [lic, setLic] = useState<LicitacionConAlerta | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'datos' | 'notas' | 'historial' | 'adjuntos'>('datos')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState<ResultadoLicitacion | ''>('')
  const [auditoria, setAuditoria] = useState<any[]>([])
  const [adjuntos, setAdjuntos] = useState<any[]>([])
  // 'desktop' | 'sidebar' | 'fab' | null — un solo menú abierto a la vez
  const [menuNoParticipe, setMenuNoParticipe] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Refs separados para el menú del sidebar (desktop) y el FAB (móvil).
  // Un solo ref compartido hace que el último montado gane → el FAB (oculto
  // en desktop) sobreescribía el ref del sidebar, rompiendo el outside-click.
  const menuRefSidebar = useRef<HTMLDivElement>(null)
  const menuRefFab = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuNoParticipe) return
    const cerrar = (e: MouseEvent) => {
      const enSidebar = menuRefSidebar.current?.contains(e.target as Node)
      const enFab = menuRefFab.current?.contains(e.target as Node)
      if (!enSidebar && !enFab) setMenuNoParticipe(null)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuNoParticipe])

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function cargar() {
    setLoading(true)

    const [{ data: vista }, { data: extra }] = await Promise.all([
      supabase.from('v_licitaciones_con_alerta').select('*').eq('id', id).single(),
      supabase.from('licitaciones')
        .select('numero_factura,fecha_emision_factura,fecha_pago,descripcion')
        .eq('id', id).single(),
    ])

    if (vista) setLic({ ...vista, ...extra } as LicitacionConAlerta)
    setLoading(false)
  }

  async function cargarAuditoria() {
    const { data } = await supabase
      .from('auditoria')
      .select('*, usuario:usuario_id(nombre, email)')
      .eq('licitacion_id', id)
      .order('timestamp', { ascending: false })
    setAuditoria(data ?? [])
  }

  async function cargarAdjuntos() {
    const { data } = await supabase
      .from('adjuntos')
      .select('*')
      .eq('licitacion_id', id)
      .order('subido_en', { ascending: false })
    setAdjuntos(data ?? [])
  }

  async function handleEnviada() {
    setGuardando('enviada')
    setErrorMsg(null)
    try {
      await actualizarDirecto({ estado: 'enviada' })
      await cargar()
      localStorage.setItem('dashboard_stale', '1')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar')
    }
    setGuardando(null)
  }

  async function handleRegistrarResultado() {
    if (!resultadoSeleccionado) return
    setGuardando('resultado')
    setErrorMsg(null)
    try {
      await actualizarDirecto({ resultado: resultadoSeleccionado })
      await cargar()
      localStorage.setItem('dashboard_stale', '1')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar')
    }
    setGuardando(null)
  }

  const MOTIVOS_NO_PARTICIPE = [
    'Exige concesionario autorizado',
    'Fuera de rubro',
    'Sin capacidad técnica',
    'Presupuesto insuficiente',
    'Plazos muy cortos',
    'Requiere garantía/boleta',
    'Exigen patente comercial',
    'Información insuficiente',
    'Otro',
  ]

  // Update directo con el cliente browser (mismo cliente que cargar()).
  // Evita depender del server action, que puede fallar si las cookies
  // no se transmiten bien en el contexto serverless de Vercel.
  async function actualizarDirecto(campos: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('licitaciones')
      .update(campos)
      .eq('id', id)
      .select('id')  // necesario para detectar 0 filas actualizadas
    if (error) {
      console.error('[actualizarDirecto] error:', error)
      throw error
    }
    // Si no se actualizó ninguna fila, RLS bloqueó o la sesión expiró
    if (!data || data.length === 0) {
      const msg = 'Sin permisos para guardar o sesión expirada — recarga la página'
      console.error('[actualizarDirecto] 0 filas actualizadas')
      throw new Error(msg)
    }
  }

  async function handleNoParticipe(motivo: string) {
    setMenuNoParticipe(null)
    setGuardando('no_participe')
    setErrorMsg(null)
    try {
      const notaActual = lic?.notas ?? ''
      const nuevaNota = notaActual
        ? `${notaActual}\n\nNo participé: ${motivo}`
        : `No participé: ${motivo}`
      await actualizarDirecto({ estado: 'no_participe', notas: nuevaNota })
      await cargar()
      localStorage.setItem('dashboard_stale', '1')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar')
    }
    setGuardando(null)
  }

  async function handleCampoInline(campo: string, valor: string | number | null) {
    setGuardando(campo)
    setErrorMsg(null)
    try {
      await actualizarDirecto({ [campo]: valor })
      await cargar()
      localStorage.setItem('dashboard_stale', '1')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar')
    }
    setGuardando(null)
  }

  async function handleSubirAdjunto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    const { data: uploadData, error } = await supabase.storage
      .from('adjuntos')
      .upload(`${id}/${archivo.name}`, archivo)

    if (!error && uploadData) {
      const { data: urlData } = supabase.storage
        .from('adjuntos')
        .getPublicUrl(uploadData.path)

      await supabase.from('adjuntos').insert({
        licitacion_id: id,
        nombre_archivo: archivo.name,
        url_storage: urlData.publicUrl,
        mime_type: archivo.type,
        tamano_bytes: archivo.size,
      })
      await cargarAdjuntos()
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!lic) {
    return (
      <div className="p-8 text-center text-gray-500">
        Licitación no encontrada
      </div>
    )
  }

  const categoria = calcularCategoriaAlerta(lic)
  const necesitaResultado =
    lic.estado === 'enviada' &&
    new Date(lic.fecha_cierre_1) < new Date() &&
    !lic.resultado

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={urlMercadoPublico(lic.codigo_chilecompra)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 text-sm hover:underline flex items-center gap-1"
              >
                {lic.codigo_chilecompra}
                <ExternalLink className="h-3 w-3" />
              </a>
              <BadgeAlerta categoria={categoria} size="sm" />
            </div>
            <h1 className="text-base font-semibold text-gray-900 mt-1 line-clamp-1">{lic.nombre}</h1>
            <InstitucionEditable
              institucion={lic.institucion}
              onGuardar={async (nombre) => {
                setGuardando('institucion')
                await actualizarInstitucionLicitacion(id, nombre)
                await cargar()
                setGuardando(null)
              }}
              guardando={guardando === 'institucion'}
            />
          </div>
        </div>
      </div>

      {/* Banner error al guardar */}
      {errorMsg && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            {errorMsg}
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-600 text-xs font-medium flex-shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Banner registrar resultado */}
      {necesitaResultado && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-800">
              Esta licitación ya cerró. ¿Cuál fue el resultado?
            </span>
            <select
              value={resultadoSeleccionado}
              onChange={e => setResultadoSeleccionado(e.target.value as ResultadoLicitacion | '')}
              className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {(Object.entries(RESULTADOS) as [ResultadoLicitacion, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={handleRegistrarResultado}
              disabled={!resultadoSeleccionado || guardando === 'resultado'}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {guardando === 'resultado' ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {(['datos', 'notas', 'historial', 'adjuntos'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                if (t === 'historial') cargarAuditoria()
                if (t === 'adjuntos') cargarAdjuntos()
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'adjuntos' ? (
                <span className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Adjuntos
                </span>
              ) : t}
            </button>
          ))}
        </div>
      </div>

      {/* Layout 2 columnas desktop / 1 columna móvil */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 md:flex md:gap-6 md:items-start pb-28 md:pb-6">

        {/* ── Columna principal (izquierda en desktop) ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Tabs — solo en móvil / tablet */}
          <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['datos', 'notas', 'historial', 'adjuntos'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (t === 'historial') cargarAuditoria(); if (t === 'adjuntos') cargarAdjuntos() }}
                  className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
                >
                  {t === 'adjuntos' ? '📎' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción — siempre visible */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</h3>
            </div>
            <div className="p-5">
              <DescripcionEditor
                valor={lic.descripcion ?? ''}
                onGuardar={(descripcion) => handleCampoInline('descripcion', descripcion)}
                guardando={guardando === 'descripcion'}
              />
            </div>
          </div>

          {/* Sección financiera (ganadas) */}
          {lic.resultado === 'ganada' && (
            <GestionFinanciera lic={lic} guardando={guardando} onGuardar={handleCampoInline} />
          )}

          {/* Datos de la licitación */}
          <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${tab !== 'datos' ? 'md:block hidden' : ''}`}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos</h3>
            </div>
            <div className="divide-y divide-gray-50">
              <CampoInline label="Estado" valor={ESTADOS_LICITACION[lic.estado]} />
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs font-medium text-gray-500 w-32 shrink-0">Resultado</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <select
                    value={lic.resultado ?? ''}
                    onChange={e => handleCampoInline('resultado', e.target.value || null)}
                    disabled={guardando === 'resultado'}
                    className="text-sm text-gray-800 bg-transparent border border-gray-200 rounded-lg px-2 py-1 hover:border-gray-300 focus:outline-none focus:border-blue-400 cursor-pointer"
                  >
                    <option value="">— Sin resultado —</option>
                    {(Object.entries(RESULTADOS) as [ResultadoLicitacion, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {guardando === 'resultado' && <span className="text-xs text-gray-400">Guardando...</span>}
                </div>
              </div>
              <CampoInline label="Cierre 1er llamado" valor={formatFechaHora(lic.fecha_cierre_1)} />
              {lic.fecha_cierre_2 && <CampoInline label="Cierre 2do llamado" valor={formatFechaHora(lic.fecha_cierre_2)} />}
              {lic.fecha_publicacion && <CampoInline label="Publicación" valor={formatFechaHora(lic.fecha_publicacion)} />}
            </div>
          </div>

          {/* Contacto */}
          <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${tab !== 'datos' ? 'md:block hidden' : ''}`}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contacto</h3>
            </div>
            <div className="divide-y divide-gray-50">
              <CampoEditable label="Nombre" valor={lic.contacto_nombre ?? ''} placeholder="Ej: Juan Pérez" guardando={guardando === 'contacto_nombre'} onGuardar={(v) => handleCampoInline('contacto_nombre', v || null)} />
              <CampoEditable label="Teléfono" valor={lic.contacto_telefono ?? ''} placeholder="+569XXXXXXXX" guardando={guardando === 'contacto_telefono'} onGuardar={(v) => handleCampoInline('contacto_telefono', v || null)} />
            </div>
          </div>

          {/* Notas — móvil solo si tab activo, desktop siempre */}
          <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${tab !== 'notas' ? 'md:block hidden' : ''}`}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas</h3>
            </div>
            <div className="p-5">
              <NotasEditor valor={lic.notas ?? ''} onGuardar={async (notas) => handleCampoInline('notas', notas)} guardando={guardando === 'notas'} />
            </div>
          </div>

          {/* Historial */}
          {(tab === 'historial') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historial de cambios</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {auditoria.length === 0 && <p className="px-5 py-8 text-center text-gray-400 text-sm">Sin cambios registrados</p>}
                {auditoria.map(reg => (
                  <div key={reg.id} className="px-5 py-4 flex gap-4">
                    <Clock className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">{reg.campo}</span>:{' '}
                        <span className="text-gray-400 line-through">{reg.valor_anterior ?? 'vacío'}</span>
                        {' → '}
                        <span className="text-gray-800">{reg.valor_nuevo ?? 'vacío'}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {reg.usuario?.nombre ?? reg.usuario?.email ?? 'Sistema'} · {formatFechaHora(reg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjuntos */}
          {(tab === 'adjuntos') && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 cursor-pointer transition-colors">
                  <Paperclip className="h-4 w-4" />
                  Subir archivo
                  <input type="file" className="hidden" onChange={handleSubirAdjunto} />
                </label>
              </div>
              {adjuntos.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Sin adjuntos</p>}
              {adjuntos.map(adj => (
                <div key={adj.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{adj.nombre_archivo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatFechaHora(adj.subido_en)}</p>
                  </div>
                  <a href={adj.url_storage} target="_blank" rel="noreferrer" className="text-sm text-blue-600 font-semibold hover:underline">Descargar</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Columna derecha — solo desktop ── */}
        <div className="hidden md:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* Acciones rápidas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</h3>
            </div>
            <div className="p-3 space-y-2">
              {!lic.resultado && lic.estado !== 'cancelada' && lic.estado !== 'no_participe' && (
                <div className="relative" ref={menuRefSidebar}>
                  <button
                    onClick={() => setMenuNoParticipe(v => v === 'sidebar' ? null : 'sidebar')}
                    disabled={guardando === 'no_participe'}
                    className="flex items-center gap-2 w-full px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium border border-gray-200 transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-gray-400" />
                    No participé
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                  </button>
                  {menuNoParticipe === 'sidebar' && (
                    <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
                      {MOTIVOS_NO_PARTICIPE.map(motivo => (
                        <button key={motivo} onClick={() => handleNoParticipe(motivo)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">{motivo}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {lic.estado !== 'revisado' && !lic.resultado && lic.estado !== 'cancelada' && lic.estado !== 'no_participe' && (
                <button onClick={() => handleCampoInline('estado', 'revisado')} disabled={guardando === 'estado'} className="flex items-center gap-2 w-full px-3 py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-sm font-semibold border border-cyan-200 transition-colors">
                  <Eye className="h-4 w-4" />
                  {guardando === 'estado' ? 'Guardando...' : 'Marcar como Revisado'}
                </button>
              )}
              {lic.estado !== 'enviada' && lic.estado !== 'revisado' && !lic.resultado && (
                <button onClick={handleEnviada} disabled={guardando === 'enviada'} className="flex items-center gap-2 w-full px-3 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-green-500/25">
                  <CheckCircle className="h-4 w-4" />
                  {guardando === 'enviada' ? 'Guardando...' : 'Marcar como Enviada'}
                </button>
              )}
            </div>
          </div>

          {/* Mini navegación de tabs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Secciones</h3>
            </div>
            <div className="p-2 space-y-0.5">
              {(['historial', 'adjuntos'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (t === 'historial') cargarAuditoria(); if (t === 'adjuntos') cargarAdjuntos() }}
                  className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {t === 'historial' ? <Clock className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                  {t === 'historial' ? 'Historial' : 'Adjuntos'}
                </button>
              ))}
            </div>
          </div>

          {/* Info rápida */}
          {lic.monto_clp && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 font-medium mb-1">Monto</p>
              <p className="text-xl font-bold text-gray-900">{formatCLP(lic.monto_clp)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FAB móvil — acciones flotantes ── */}
      {!lic.resultado && lic.estado !== 'cancelada' && lic.estado !== 'no_participe' && (
        <div className="md:hidden fixed bottom-20 left-0 right-0 px-4 z-30">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 flex gap-2">
            {lic.estado !== 'enviada' && lic.estado !== 'revisado' && (
              <button
                onClick={handleEnviada}
                disabled={guardando === 'enviada'}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {guardando === 'enviada' ? '...' : 'Enviada'}
              </button>
            )}
            {lic.estado !== 'revisado' && (
              <button
                onClick={() => handleCampoInline('estado', 'revisado')}
                disabled={guardando === 'estado'}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                {guardando === 'estado' ? '...' : 'Revisado'}
              </button>
            )}
            <div className="relative" ref={menuRefFab}>
                <button
                  onClick={() => setMenuNoParticipe(v => v === 'fab' ? null : 'fab')}
                  disabled={guardando === 'no_participe'}
                  className="flex items-center justify-center gap-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold border border-gray-200 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                </button>
                {menuNoParticipe === 'fab' && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 max-h-72 overflow-y-auto">
                    <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">No participé porque...</p>
                    {MOTIVOS_NO_PARTICIPE.map(motivo => (
                      <button key={motivo} onClick={() => handleNoParticipe(motivo)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">{motivo}</button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Campo de solo lectura (edición inline se haría con un modal/popover)
function CampoInline({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-start px-5 py-4 gap-4">
      <dt className="w-44 flex-shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm text-gray-800 font-medium">{valor}</dd>
    </div>
  )
}

function NotasEditor({
  valor,
  onGuardar,
  guardando,
}: {
  valor: string
  onGuardar: (notas: string) => Promise<void>
  guardando: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)

  async function guardar() {
    await onGuardar(texto)
    setEditando(false)
  }

  if (!editando) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Notas</h3>
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>
        {texto ? (
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{texto}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Sin notas. Haz clic en Editar para agregar.</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Notas (Markdown soportado)</h3>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={10}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Escribe notas en Markdown..."
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={() => { setTexto(valor); setEditando(false) }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function DescripcionEditor({
  valor,
  onGuardar,
  guardando,
}: {
  valor: string
  onGuardar: (v: string) => Promise<void>
  guardando: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)

  async function guardar() {
    await onGuardar(texto)
    setEditando(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Descripción</h3>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {texto ? 'Editar' : 'Agregar'}
          </button>
        )}
      </div>

      {editando ? (
        <div>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={6}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Pega aquí el detalle de la licitación desde Mercado Público..."
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setTexto(valor); setEditando(false) }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : texto ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{texto}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Sin descripción — haz clic en Agregar para ingresar el detalle desde Mercado Público.</p>
      )}
    </div>
  )
}

function InstitucionEditable({
  institucion,
  onGuardar,
  guardando,
}: {
  institucion: string
  onGuardar: (nombre: string) => Promise<void>
  guardando: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(institucion)
  const inputRef = useRef<HTMLInputElement>(null)
  const sinInfo = !institucion || institucion.toLowerCase().includes('sin información') || institucion.toLowerCase().includes('sin institucion') || institucion === 'Sin institución'

  useEffect(() => {
    if (editando) inputRef.current?.focus()
  }, [editando])

  async function guardar() {
    if (!valor.trim() || valor === institucion) { setEditando(false); return }
    await onGuardar(valor.trim())
    setEditando(false)
  }

  if (editando) {
    return (
      <div className="flex items-center gap-2 mt-0.5">
        <input
          ref={inputRef}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setValor(institucion); setEditando(false) } }}
          className="text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
          disabled={guardando}
        />
        <button onClick={guardar} disabled={guardando} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {guardando ? '...' : 'OK'}
        </button>
        <button onClick={() => { setValor(institucion); setEditando(false) }} className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditando(true)}
      className={`flex items-center gap-1.5 mt-0.5 group text-left ${sinInfo ? 'text-amber-600 font-medium' : 'text-gray-500'}`}
    >
      <span className="text-sm">{sinInfo ? '⚠ Sin institución — haz clic para corregir' : institucion}</span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </button>
  )
}

function GestionFinanciera({
  lic,
  guardando,
  onGuardar,
}: {
  lic: LicitacionConAlerta
  guardando: string | null
  onGuardar: (campo: string, valor: string | number | null) => Promise<void>
}) {
  const PASOS_OC: EstadoOC[] = ['emitida', 'aceptada', 'facturada', 'pagada']
  const LABELS_OC: Record<EstadoOC, string> = {
    emitida:   'OC Emitida',
    aceptada:  'OC Aceptada',
    facturada: 'Facturada',
    pagada:    'Pagada',
  }
  const idxActual = lic.estado_oc ? PASOS_OC.indexOf(lic.estado_oc) : -1

  // Formatear fecha ISO → value para input date
  const toDateInput = (iso: string | null) => iso ? iso.slice(0, 10) : ''

  return (
    <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <h3 className="text-sm font-semibold text-green-800">Gestión financiera — Licitación ganada</h3>
      </div>

      {/* Barra de progreso OC */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Estado de la orden de compra</p>
        <div className="flex items-center gap-0">
          {PASOS_OC.map((paso, idx) => {
            const completado = idx <= idxActual
            const esActual = idx === idxActual
            const esSiguiente = idx === idxActual + 1
            return (
              <div key={paso} className="flex items-center flex-1">
                <button
                  onClick={() => onGuardar('estado_oc', paso)}
                  disabled={guardando === 'estado_oc'}
                  title={esSiguiente ? `Marcar como ${LABELS_OC[paso]}` : undefined}
                  className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-lg transition-all ${
                    esActual
                      ? 'bg-green-100 border-2 border-green-500'
                      : completado
                      ? 'bg-green-50 border border-green-200 opacity-70'
                      : esSiguiente
                      ? 'border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 cursor-pointer'
                      : 'border border-gray-100 opacity-40 cursor-default'
                  }`}
                >
                  <span className={`text-xs font-semibold ${esActual ? 'text-green-700' : completado ? 'text-green-600' : 'text-gray-400'}`}>
                    {completado && !esActual ? '✓' : idx + 1}
                  </span>
                  <span className={`text-xs text-center leading-tight ${esActual ? 'text-green-800 font-medium' : 'text-gray-500'}`}>
                    {LABELS_OC[paso]}
                  </span>
                </button>
                {idx < PASOS_OC.length - 1 && (
                  <div className={`h-0.5 w-3 flex-shrink-0 ${idx < idxActual ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Campos financieros */}
      <div className="divide-y divide-gray-100">
        {/* Monto */}
        <CampoEditable
          label="Monto adjudicado (CLP)"
          valor={lic.monto_clp ? String(Math.round(lic.monto_clp)) : ''}
          placeholder="Ej: 1500000"
          tipo="number"
          guardando={guardando === 'monto_clp'}
          onGuardar={(v) => onGuardar('monto_clp', v ? Number(v) : null)}
          formatear={(v) => v ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(v)) : '—'}
        />

        {/* Orden de compra */}
        <CampoEditable
          label="Número de orden de compra"
          valor={lic.orden_compra ?? ''}
          placeholder="Ej: 1234567-0"
          guardando={guardando === 'orden_compra'}
          onGuardar={(v) => onGuardar('orden_compra', v || null)}
        />

        {/* Número de factura */}
        <CampoEditable
          label="Número de factura"
          valor={lic.numero_factura ?? ''}
          placeholder="Ej: 4521"
          guardando={guardando === 'numero_factura'}
          onGuardar={(v) => onGuardar('numero_factura', v || null)}
        />

        {/* Fecha emisión factura */}
        <CampoEditable
          label="Fecha emisión factura"
          valor={toDateInput(lic.fecha_emision_factura)}
          tipo="date"
          guardando={guardando === 'fecha_emision_factura'}
          onGuardar={(v) => onGuardar('fecha_emision_factura', v || null)}
          formatear={(v) => v ? new Date(v + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
        />

        {/* Fecha pago */}
        <CampoEditable
          label="Fecha de pago"
          valor={toDateInput(lic.fecha_pago)}
          tipo="date"
          guardando={guardando === 'fecha_pago'}
          onGuardar={(v) => onGuardar('fecha_pago', v || null)}
          formatear={(v) => v ? new Date(v + 'T12:00:00').toLocaleDateString('es-CL') : '—'}
        />
      </div>
    </div>
  )
}

type EstadoOC = 'emitida' | 'aceptada' | 'facturada' | 'pagada'

function CampoEditable({
  label,
  valor,
  placeholder = '',
  tipo = 'text',
  guardando,
  onGuardar,
  formatear,
}: {
  label: string
  valor: string
  placeholder?: string
  tipo?: 'text' | 'number' | 'date'
  guardando: boolean
  onGuardar: (v: string) => Promise<void>
  formatear?: (v: string) => string
}) {
  const [editando, setEditando] = useState(false)
  const [local, setLocal] = useState(valor)

  async function guardar() {
    await onGuardar(local)
    setEditando(false)
  }

  const display = valor ? (formatear ? formatear(valor) : valor) : '—'

  if (editando) {
    return (
      <div className="px-5 py-3 flex items-center gap-3">
        <span className="text-sm text-gray-500 w-48 flex-shrink-0">{label}</span>
        <input
          type={tipo}
          value={local}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setLocal(valor); setEditando(false) } }}
          autoFocus
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={guardando}
        />
        <button onClick={guardar} disabled={guardando} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {guardando ? '...' : 'OK'}
        </button>
        <button onClick={() => { setLocal(valor); setEditando(false) }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setLocal(valor); setEditando(true) }}
      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group text-left"
    >
      <span className="text-sm text-gray-500 w-48 flex-shrink-0">{label}</span>
      <span className={`text-sm flex-1 ${valor ? 'text-gray-900 font-medium' : 'text-gray-300 italic'}`}>{display}</span>
      <Edit2 className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  )
}
