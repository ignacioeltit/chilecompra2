'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileSpreadsheet, Trash } from 'lucide-react'
import { useUser } from '@/hooks/useSupabase'

interface Resultado {
  importados: number
  errores: number
  detalles: any[]
}

export default function ImportarPage() {
  const router = useRouter()
  const { perfil } = useUser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState(false)

  if (perfil && perfil.rol !== 'admin') {
    return (
      <div className="p-8 text-center text-gray-500">
        Solo administradores pueden importar datos.
      </div>
    )
  }

  async function handleImportar() {
    if (!archivo) return
    setCargando(true)
    setError(null)
    setResultado(null)

    const form = new FormData()
    form.append('file', archivo)

    try {
      const res = await fetch('/api/import', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = json?.error ?? 'Error al importar'
        setError(msg)
      } else {
        const data = json?.resultados ?? json
        const normalized: Resultado = {
          importados: data?.importados ?? 0,
          errores: data?.errores ?? 0,
          detalles: data?.detalles ?? [],
        }
        setResultado(normalized)
        // Reset selections
        const sel: Record<string, boolean> = {};
        (normalized.detalles || []).forEach((d: any) => {
          if (d?.codigo) sel[d.codigo] = false
        })
        setSelected(sel)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }

  async function handleDeleteSelected() {
    const codigos = Object.keys(selected).filter(k => selected[k])
    if (!codigos.length) return
    setDeleting(true)
    try {
      const res = await fetch('/api/import/delete', { method: 'POST', body: JSON.stringify({ codigos }), headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'Error al eliminar')
      } else {
        // Filtrar detalles para remover los eliminados
        setResultado(prev => prev ? { ...prev, detalles: prev.detalles.filter(d => !codigos.includes(d.codigo)) } : prev)
        setSelected({})
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Importar desde Excel</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Columnas esperadas en el Excel</h3>
          <div className="grid grid-cols-2 gap-1 text-xs text-blue-700">
            {[
              ['ID / Código',     'codigo_chilecompra'],
              ['Nombre',          'nombre'],
              ['Institución',     'institución (crea si no existe)'],
              ['Estado',          'normalizado (ENVIADA, REVISAR…)'],
              ['RESULTADO',       'ganada, perdida, desierta…'],
              ['Fecha de cierre 1ER LLAMADO', 'dd-mm-yyyy a las hh:mm:ss'],
              ['Orden de compra', 'orden_compra'],
              ['Monto',           'monto_clp'],
            ].map(([col, destino]) => (
              <div key={col} className="flex gap-2">
                <span className="font-mono bg-blue-100 px-1 rounded text-[10px]">{col}</span>
                <span>→ {destino}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            archivo ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => setArchivo(e.target.files?.[0] ?? null)}
          />
          {archivo ? (
            <div className="flex items-center justify-center gap-3 text-blue-700">
              <FileSpreadsheet className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold text-sm">{archivo.name}</p>
                <p className="text-xs text-blue-500">{(archivo.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <div>
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</p>
              <p className="text-xs text-gray-400 mt-1">Soporta .xlsx y .xls</p>
            </div>
          )}
        </div>

        <button
          onClick={handleImportar}
          disabled={!archivo || cargando}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {cargando ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importar licitaciones
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Error al importar</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-800">Importación completada</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{resultado.importados}</div>
                <div className="text-xs text-green-600">importadas correctamente</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${resultado.errores > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${resultado.errores > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {resultado.errores}
                </div>
                <div className={`text-xs ${resultado.errores > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  con errores
                </div>
              </div>
            </div>

            {resultado?.detalles && resultado.detalles.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Detalles de errores / importados:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                  {resultado.detalles.map((d, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!selected[d?.codigo]}
                        onChange={(e) => setSelected(prev => ({ ...prev, [d?.codigo]: e.target.checked }))}
                        className="mt-1"
                      />
                      <div className="flex-1 text-xs text-gray-600 font-mono">
                        <div>{d.codigo}</div>
                        <div className="text-[11px] text-gray-500">{typeof d.values === 'string' ? d.values : JSON.stringify(d.values)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash className="h-4 w-4" />
                    {deleting ? 'Eliminando...' : 'Eliminar seleccionadas'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
