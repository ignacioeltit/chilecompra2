'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Info } from 'lucide-react'
import { licitacionSchema, type LicitacionSchema } from '@/lib/validations/licitacion'
import { crearLicitacion } from '@/app/actions/licitaciones'
import { ESTADOS_LICITACION, RESULTADOS, ESTADOS_OC, detectarTipo } from '@/types'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const TIPOS_HINT: Record<string, string> = {
  COT: 'Compra Ágil (Cotización) — monto ≤ 100 UTM',
  LE:  'Licitación de menor cuantía — 100 a 1.000 UTM',
  LP:  'Licitación de mayor cuantía — sobre 1.000 UTM',
}

export default function NuevaLicitacionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instituciones, setInstituciones] = useState<{ id: string; nombre: string }[]>([])
  const [busqInst, setBusqInst] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LicitacionSchema>({
    resolver: zodResolver(licitacionSchema),
    defaultValues: { estado: 'sin_definir' },
  })

  const codigoWatch = watch('codigo_chilecompra') ?? ''
  const tipoCodigo = detectarTipo(codigoWatch)

  useEffect(() => {
    if (!busqInst.trim()) { setInstituciones([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('instituciones')
        .select('id, nombre')
        .ilike('nombre', `%${busqInst}%`)
        .limit(8)
      setInstituciones(data ?? [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqInst, supabase])

  async function onSubmit(data: LicitacionSchema) {
    setEnviando(true)
    setError(null)
    const result = await crearLicitacion(data as any)
    if (result.error) {
      setError(result.error)
      setEnviando(false)
    } else {
      router.push(`/licitaciones/${result.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Nueva licitación</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código Chilecompra <span className="text-red-500">*</span>
            </label>
            <input
              {...register('codigo_chilecompra')}
              placeholder="Ej: 3245-117-COT24"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {errors.codigo_chilecompra && (
              <p className="text-xs text-red-600 mt-1">{errors.codigo_chilecompra.message}</p>
            )}
            {tipoCodigo !== 'desconocido' && codigoWatch && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-600">
                <Info className="h-3.5 w-3.5" />
                {TIPOS_HINT[tipoCodigo]}
              </div>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre / Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('nombre')}
              rows={2}
              placeholder="Suministro de equipos médicos para el hospital..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {errors.nombre && (
              <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>
            )}
          </div>

          {/* Institución */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institución <span className="text-red-500">*</span>
            </label>
            <input
              {...register('institucion')}
              value={busqInst}
              onChange={e => setBusqInst(e.target.value)}
              placeholder="Buscar o escribir nombre..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {instituciones.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {instituciones.map(inst => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => { setBusqInst(inst.nombre); setInstituciones([]) }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    {inst.nombre}
                  </button>
                ))}
              </div>
            )}
            {errors.institucion && (
              <p className="text-xs text-red-600 mt-1">{errors.institucion.message}</p>
            )}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publicación
              </label>
              <input
                type="datetime-local"
                {...register('fecha_publicacion')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cierre 1er llamado <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                {...register('fecha_cierre_1')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.fecha_cierre_1 && (
                <p className="text-xs text-red-600 mt-1">{errors.fecha_cierre_1.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cierre 2do llamado
              </label>
              <input
                type="datetime-local"
                {...register('fecha_cierre_2')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto (CLP)
              </label>
              <input
                type="number"
                {...register('monto_clp', { valueAsNumber: true })}
                placeholder="Ej: 1500000"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.monto_clp && (
                <p className="text-xs text-red-600 mt-1">{errors.monto_clp.message}</p>
              )}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              {...register('estado')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(ESTADOS_LICITACION).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas <span className="text-xs text-gray-400">(Markdown)</span>
            </label>
            <textarea
              {...register('notas')}
              rows={3}
              placeholder="Observaciones, tareas pendientes..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre contacto</label>
              <input
                {...register('contacto_nombre')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (+569XXXXXXXX)</label>
              <input
                {...register('contacto_telefono')}
                placeholder="+56912345678"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.contacto_telefono && (
                <p className="text-xs text-red-600 mt-1">{errors.contacto_telefono.message}</p>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              {enviando ? 'Guardando...' : 'Crear licitación'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
