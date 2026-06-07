'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Building2, Calendar, DollarSign, ExternalLink, Eye, MapPin, Search, X } from 'lucide-react'
import { useUser } from '@/hooks/useSupabase'
import { formatCLP, urlMercadoPublico } from '@/lib/utils/format'

const REGIONES_MP: { codigo: string; nombre: string; abrev: string }[] = [
  { codigo: '15', nombre: 'Arica y Parinacota', abrev: 'Arica' },
  { codigo: '1',  nombre: 'Tarapacá',           abrev: 'Tarapacá' },
  { codigo: '2',  nombre: 'Antofagasta',         abrev: 'Antofag.' },
  { codigo: '3',  nombre: 'Atacama',             abrev: 'Atacama' },
  { codigo: '4',  nombre: 'Coquimbo',            abrev: 'Coquimbo' },
  { codigo: '5',  nombre: 'Valparaíso',          abrev: 'Valpo.' },
  { codigo: '13', nombre: 'Metropolitana',       abrev: 'RM' },
  { codigo: '6',  nombre: "O'Higgins",           abrev: "O'Higg." },
  { codigo: '7',  nombre: 'Maule',               abrev: 'Maule' },
  { codigo: '16', nombre: 'Ñuble',               abrev: 'Ñuble' },
  { codigo: '8',  nombre: 'Biobío',              abrev: 'Biobío' },
  { codigo: '9',  nombre: 'Araucanía',           abrev: 'Araucanía' },
  { codigo: '14', nombre: 'Los Ríos',            abrev: 'Los Ríos' },
  { codigo: '10', nombre: 'Los Lagos',           abrev: 'Los Lagos' },
  { codigo: '11', nombre: 'Aysén',               abrev: 'Aysén' },
  { codigo: '12', nombre: 'Magallanes',          abrev: 'Magall.' },
]

interface CompraAgil {
  codigo: string
  nombre: string
  descripcion: string | null
  fecha_publicacion: string | null
  fecha_cierre: string | null
  organismo: string
  monto: number | null
  tipo: 'COT' | 'LE' | 'LP' | 'LR' | 'L1' | 'LC'
  region?: string
}

interface ResultadoSync {
  nuevas: CompraAgil[]
  yaExisten: number
  ultimaPublicacion: string | null
  tablaExiste: boolean
  total: number
}

export default function SincronizarPage() {
  const router = useRouter()
  const { perfil } = useUser()

  const hoy = new Date().toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(hoy)
  const [dateTo, setDateTo] = useState(hoy)
  const [codigoBuscar, setCodigoBuscar] = useState('')
  const [buscandoCodigo, setBuscandoCodigo] = useState(false)
  const [resultadoCodigo, setResultadoCodigo] = useState<{ item: CompraAgil; yaExiste: boolean } | null>(null)
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null)
  const [importadoCodigo, setImportadoCodigo] = useState(false)

  const [regionesSeleccionadas, setRegionesSeleccionadas] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(['16'])
    const saved = localStorage.getItem('sync_regiones')
    return saved ? new Set(JSON.parse(saved)) : new Set(['16'])
  })
  const [incluirAnteriores, setIncluirAnteriores] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoSync | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<{ importados: number; errores: string[] } | null>(null)


  if (perfil && perfil.rol !== 'admin') {
    return <div className="p-8 text-center text-gray-500">Solo administradores pueden sincronizar.</div>
  }

  function toggleRegion(codigo: string) {
    setRegionesSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        if (next.size === 1) return prev // al menos 1 siempre activa
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      localStorage.setItem('sync_regiones', JSON.stringify([...next]))
      return next
    })
  }

  async function buscar(from: string, to: string, conAnteriores: boolean) {
    setBuscando(true)
    setError(null)
    setResultado(null)
    setSeleccionadas(new Set())
    setImportResult(null)

    try {
      const params = new URLSearchParams({ date_from: from, date_to: to, regiones: [...regionesSeleccionadas].join(',') })
      if (conAnteriores) params.set('incluir_anteriores', 'true')
      const res = await fetch(`/api/sync?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al buscar'); return }
      setResultado(json)
      setSeleccionadas(new Set(json.nuevas.map((c: CompraAgil) => c.codigo)))
    } catch (e) {
      setError(String(e))
    } finally {
      setBuscando(false)
    }
  }

  function toggleAnteriores() {
    const nuevo = !incluirAnteriores
    setIncluirAnteriores(nuevo)
    buscar(dateFrom, dateTo, nuevo)
  }

  const nombreRegion = (codigo: string) =>
    REGIONES_MP.find(r => r.codigo === codigo)?.abrev ?? `R${codigo}`

  async function buscarPorCodigo() {
    const codigo = codigoBuscar.trim()
    if (!codigo) return
    setBuscandoCodigo(true)
    setErrorCodigo(null)
    setResultadoCodigo(null)
    setImportadoCodigo(false)
    try {
      const res = await fetch(`/api/sync?codigo=${encodeURIComponent(codigo)}`)
      const json = await res.json()
      if (!res.ok) { setErrorCodigo(json.error ?? 'No encontrada'); return }
      setResultadoCodigo(json)
    } catch (e) {
      setErrorCodigo(String(e))
    } finally {
      setBuscandoCodigo(false)
    }
  }

  async function importarCodigo() {
    if (!resultadoCodigo) return
    setImportando(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [resultadoCodigo.item] }),
      })
      const json = await res.json()
      if (res.ok && json.importados > 0) {
        setImportadoCodigo(true)
        setResultadoCodigo(prev => prev ? { ...prev, yaExiste: true } : prev)
      } else {
        setErrorCodigo(json.errores?.[0] ?? 'Error al importar')
      }
    } catch (e) {
      setErrorCodigo(String(e))
    } finally {
      setImportando(false)
    }
  }

  function toggleTodas() {
    if (!resultado) return
    if (seleccionadas.size === resultado.nuevas.length) setSeleccionadas(new Set())
    else setSeleccionadas(new Set(resultado.nuevas.map(c => c.codigo)))
  }

  function toggleItem(codigo: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  async function handleImportar() {
    if (!resultado || !seleccionadas.size) return
    setImportando(true)
    setError(null)

    const items = resultado.nuevas.filter(c => seleccionadas.has(c.codigo))
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al importar'); return }
      setImportResult(json)
      setResultado(prev => prev ? {
        ...prev,
        nuevas: prev.nuevas.filter(c => !seleccionadas.has(c.codigo)),
      } : prev)
      setSeleccionadas(new Set())
    } catch (e) {
      setError(String(e))
    } finally {
      setImportando(false)
    }
  }

  const diasCierre = (fechaCierre: string | null) => {
    if (!fechaCierre) return 999
    const cierre = new Date(fechaCierre)
    return Math.ceil((cierre.getTime() - Date.now()) / 86400000)
  }

  const nuevas = resultado?.nuevas ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Mercado Público — Compras ágiles</h1>
              <p className="text-xs text-gray-500">Solo muestra licitaciones nuevas que aún no has revisado</p>
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Desde</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">Hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => buscar(dateFrom, dateTo, incluirAnteriores)}
              disabled={buscando}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${buscando ? 'animate-spin' : ''}`} />
              {buscando ? 'Buscando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* Selector de regiones */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1 flex-shrink-0">
              <MapPin className="h-3.5 w-3.5" />
              Regiones
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REGIONES_MP.map(r => {
                const activa = regionesSeleccionadas.has(r.codigo)
                return (
                  <button
                    key={r.codigo}
                    onClick={() => toggleRegion(r.codigo)}
                    title={r.nombre}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activa
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {r.abrev}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* Búsqueda por código */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            Buscar por código
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codigoBuscar}
              onChange={e => { setCodigoBuscar(e.target.value); setResultadoCodigo(null); setErrorCodigo(null); setImportadoCodigo(false) }}
              onKeyDown={e => e.key === 'Enter' && buscarPorCodigo()}
              placeholder="Ej: 3904-510-COT26 o 1051425-20-LP26"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {codigoBuscar && (
              <button onClick={() => { setCodigoBuscar(''); setResultadoCodigo(null); setErrorCodigo(null) }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={buscarPorCodigo}
              disabled={!codigoBuscar.trim() || buscandoCodigo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {buscandoCodigo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Buscar
            </button>
          </div>

          {/* Error búsqueda por código */}
          {errorCodigo && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-red-600 mb-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {errorCodigo === 'No encontrada en Mercado Público'
                  ? 'No encontrada en Mercado Público — puede ser muy antigua o el código puede estar incorrecto.'
                  : errorCodigo}
              </div>
              {errorCodigo === 'No encontrada en Mercado Público' && (
                <a
                  href={`/licitaciones/nueva?codigo=${encodeURIComponent(codigoBuscar.trim())}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Crear licitación con este código manualmente →
                </a>
              )}
            </div>
          )}

          {/* Resultado */}
          {resultadoCodigo && (
            <div className={`mt-3 border rounded-lg p-3 ${resultadoCodigo.yaExiste ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      resultadoCodigo.item.tipo === 'COT' ? 'bg-blue-100 text-blue-700' :
                      resultadoCodigo.item.tipo === 'LE'  ? 'bg-purple-100 text-purple-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>{resultadoCodigo.item.tipo}</span>
                    <a
                      href={urlMercadoPublico(resultadoCodigo.item.codigo)}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      {resultadoCodigo.item.codigo}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    {resultadoCodigo.yaExiste && (
                      <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">Ya importada</span>
                    )}
                    {importadoCodigo && (
                      <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Importada
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{resultadoCodigo.item.nombre}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{resultadoCodigo.item.organismo}</span>
                    {resultadoCodigo.item.fecha_cierre && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Cierra {new Date(resultadoCodigo.item.fecha_cierre).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone:'America/Santiago' })}
                      </span>
                    )}
                    {resultadoCodigo.item.monto != null && (
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCLP(resultadoCodigo.item.monto)}</span>
                    )}
                  </div>
                </div>
                {!resultadoCodigo.yaExiste && !importadoCodigo && (
                  <button
                    onClick={importarCodigo}
                    disabled={importando}
                    className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {importando ? 'Agregando...' : 'Agregar'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Aviso tabla faltante */}
        {resultado && !resultado.tablaExiste && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <p className="font-semibold mb-1">Filtro de historial desactivado</p>
            <p className="text-xs mb-2">Para recordar qué licitaciones ya revisaste, corre este SQL en Supabase SQL Editor:</p>
            <pre className="bg-amber-100 rounded p-2 text-xs font-mono overflow-x-auto">
{`CREATE TABLE sync_estado (
  org_id uuid PRIMARY KEY,
  ultima_publicacion timestamptz
);`}
            </pre>
            <p className="text-xs mt-2 text-amber-700">Mientras tanto funciona igual, pero volverán a aparecer todas en la próxima consulta.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Éxito import */}
        {importResult && importResult.importados > 0 && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-800">
              {importResult.importados} licitacion{importResult.importados !== 1 ? 'es' : ''} agregada{importResult.importados !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Spinner */}
        {buscando && !resultado && (
          <div className="py-20 text-center text-gray-400 text-sm">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-blue-400" />
            Consultando Mercado Público...
          </div>
        )}

        {/* Resultados */}
        {resultado && !buscando && (
          <div className="bg-white rounded-xl border border-gray-200">
            {/* Barra de acciones */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  {nuevas.length === 0
                    ? 'No hay licitaciones nuevas en este rango'
                    : <><span className="font-semibold text-gray-900">{nuevas.length}</span> nueva{nuevas.length !== 1 ? 's' : ''}</>
                  }
                </p>

                {/* Toggle ver anteriores */}
                <button
                  onClick={toggleAnteriores}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    incluirAnteriores
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  {incluirAnteriores ? 'Solo nuevas' : 'Ver anteriores también'}
                </button>
                {resultado.ultimaPublicacion && !incluirAnteriores && (
                  <span className="text-xs text-gray-400">
                    desde {new Date(resultado.ultimaPublicacion).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone:'America/Santiago' })}
                  </span>
                )}
              </div>

              {nuevas.length > 0 && (
                <div className="flex items-center gap-3">
                  <button onClick={toggleTodas} className="text-xs text-blue-600 hover:underline">
                    {seleccionadas.size === nuevas.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                  <button
                    onClick={handleImportar}
                    disabled={!seleccionadas.size || importando}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {importando ? 'Agregando...' : `Agregar ${seleccionadas.size}`}
                  </button>
                </div>
              )}
            </div>

            {/* Items */}
            {nuevas.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <p className="text-gray-400 text-sm">Todo al día — no hay compras ágiles nuevas.</p>
                {!incluirAnteriores && (
                  <button onClick={toggleAnteriores} className="text-sm text-blue-600 hover:underline">
                    Ver anteriores también
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {nuevas.map(item => {
                  const dias = diasCierre(item.fecha_cierre)
                  return (
                    <label
                      key={item.codigo}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(item.codigo)}
                        onChange={() => toggleItem(item.codigo)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            item.tipo === 'COT' ? 'bg-blue-100 text-blue-700' :
                            item.tipo === 'LE'  ? 'bg-purple-100 text-purple-700' :
                            item.tipo === 'LP'  ? 'bg-indigo-100 text-indigo-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {item.tipo}
                          </span>
                          <a
                            href={urlMercadoPublico(item.codigo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-mono text-blue-500 hover:underline flex items-center gap-0.5"
                          >
                            {item.codigo}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                          {item.fecha_cierre && (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              dias <= 0 ? 'bg-red-100 text-red-700' :
                              dias <= 1 ? 'bg-red-100 text-red-700' :
                              dias <= 3 ? 'bg-orange-100 text-orange-700' :
                                          'bg-gray-100 text-gray-500'
                            }`}>
                              {dias <= 0 ? 'vence hoy' : `${dias}d`}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.nombre}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {item.organismo}
                          </span>
                          {item.region && (
                            <span className="flex items-center gap-1 text-blue-500">
                              <MapPin className="h-3 w-3" />
                              {nombreRegion(item.region)}
                            </span>
                          )}
                          {item.fecha_publicacion && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Publicada {new Date(item.fecha_publicacion).toLocaleString('es-CL', {
                                day: '2-digit', month: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                                timeZone: 'America/Santiago',
                              })}
                            </span>
                          )}
                          {item.fecha_cierre && (
                            <span className="flex items-center gap-1 text-gray-400">
                              Cierra {item.fecha_cierre.replace('T', ' ').slice(0, 16).replace(/-03:00$/, '')}
                            </span>
                          )}
                          {item.monto != null && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatCLP(item.monto)}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
