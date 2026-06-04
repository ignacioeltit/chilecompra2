'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { licitacionSchema } from '@/lib/validations/licitacion'
import { type LicitacionFormData } from '@/types'

// ============================================================
// Actualizar institución de una licitación
// ============================================================
export async function actualizarInstitucionLicitacion(licitacionId: string, nombreInstitucion: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol === 'lector') return { error: 'Sin permisos' }

  const nombre = nombreInstitucion.trim()
  if (!nombre) return { error: 'Nombre requerido' }

  // Buscar institución existente (limit 1 para evitar error con duplicados)
  const { data: matches } = await supabase
    .from('instituciones').select('id')
    .eq('org_id', perfil.org_id).ilike('nombre', nombre).limit(1)

  let instId: string | null = null
  if (matches && matches.length > 0) {
    instId = matches[0].id
  } else {
    const { data: nueva } = await supabase
      .from('instituciones').insert({ org_id: perfil.org_id, nombre })
      .select('id').single()
    instId = nueva?.id ?? null
  }

  const { error } = await supabase
    .from('licitaciones')
    .update({ institucion: nombre, institucion_id: instId })
    .eq('id', licitacionId).eq('org_id', perfil.org_id)

  if (error) return { error: error.message }
  revalidatePath(`/licitaciones/${licitacionId}`)
  revalidatePath('/licitaciones')
  return { ok: true }
}

// ============================================================
// Crear licitación
// ============================================================
export async function crearLicitacion(data: LicitacionFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('org_id, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol === 'lector') return { error: 'Sin permisos' }

  const parsed = licitacionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Normalizar campos de fecha: convertir '' a null para evitar errores en Postgres
  const payload = {
    ...parsed.data,
    fecha_publicacion: parsed.data.fecha_publicacion ? parsed.data.fecha_publicacion : null,
    fecha_cierre_2: parsed.data.fecha_cierre_2 ? parsed.data.fecha_cierre_2 : null,
    // Convertir contacto vacío a null para respetar el constraint en la BD
    contacto_telefono: parsed.data.contacto_telefono && parsed.data.contacto_telefono !== ''
      ? parsed.data.contacto_telefono
      : null,
  }

  // Buscar/crear institución
  let instId = data.institucion_id
  if (!instId) {
    const { data: existente } = await supabase
      .from('instituciones')
      .select('id')
      .eq('org_id', perfil.org_id)
      .ilike('nombre', data.institucion)
      .single()

    if (existente) {
      instId = existente.id
    } else {
      const { data: nueva } = await supabase
        .from('instituciones')
        .insert({ org_id: perfil.org_id, nombre: data.institucion })
        .select('id')
        .single()
      instId = nueva?.id
    }
  }

  const { data: licitacion, error } = await supabase
    .from('licitaciones')
    .insert({
      ...payload,
      org_id: perfil.org_id,
      institucion_id: instId,
      creado_por: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/licitaciones')
  revalidatePath('/dashboard')
  return { id: licitacion.id }
}

// ============================================================
// Actualizar licitación
// ============================================================
export async function actualizarLicitacion(id: string, data: Partial<LicitacionFormData>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('org_id, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol === 'lector') return { error: 'Sin permisos' }

  // Normalizar fechas en updates: convertir '' a null
  const dataNormalized = {
    ...data,
    ...(data.fecha_publicacion !== undefined ? { fecha_publicacion: data.fecha_publicacion || null } : {}),
    ...(data.fecha_cierre_1 !== undefined ? { fecha_cierre_1: data.fecha_cierre_1 || null } : {}),
    ...(data.fecha_cierre_2 !== undefined ? { fecha_cierre_2: data.fecha_cierre_2 || null } : {}),
    ...(data.contacto_telefono !== undefined
      ? { contacto_telefono: data.contacto_telefono || null }
      : {}),
  }

  const { error } = await supabase
    .from('licitaciones')
    .update(dataNormalized)
    .eq('id', id)
    .eq('org_id', perfil.org_id)

  if (error) return { error: error.message }

  revalidatePath(`/licitaciones/${id}`)
  revalidatePath('/licitaciones')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================
// Marcar como enviada
// ============================================================
export async function marcarEnviada(id: string) {
  return actualizarLicitacion(id, { estado: 'enviada' })
}

// ============================================================
// Registrar resultado
// ============================================================
export async function registrarResultado(
  id: string,
  resultado: LicitacionFormData['resultado'],
  orden_compra?: string,
  monto_clp?: number
) {
  const updates: Partial<LicitacionFormData> = { resultado }
  if (orden_compra) updates.orden_compra = orden_compra
  if (monto_clp) updates.monto_clp = monto_clp
  return actualizarLicitacion(id, updates)
}

// ============================================================
// Eliminar licitación (solo admin)
// ============================================================
export async function eliminarLicitacion(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('org_id, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') return { error: 'Solo administradores pueden eliminar' }

  const { error } = await supabase
    .from('licitaciones')
    .delete()
    .eq('id', id)
    .eq('org_id', perfil.org_id)

  if (error) return { error: error.message }

  revalidatePath('/licitaciones')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================
// Obtener una licitación
// ============================================================
export async function obtenerLicitacion(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_licitaciones_con_alerta')
    .select(`
      *,
      usuario_asignado:asignado_a(id, nombre, email),
      usuario_creador:creado_por(id, nombre, email)
    `)
    .eq('id', id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

// ============================================================
// Obtener lista paginada
// ============================================================
export async function listarLicitaciones(params: {
  query?: string
  estado?: string[]
  resultado?: string[]
  asignado_a?: string
  fecha_desde?: string
  fecha_hasta?: string
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', data: [] }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!perfil) return { error: 'Perfil no encontrado', data: [] }

  const { page = 1, pageSize = 50 } = params

  const { data, error } = await supabase.rpc('buscar_licitaciones', {
    p_org_id:      perfil.org_id,
    p_query:       params.query || null,
    p_estado:      params.estado?.length ? params.estado : null,
    p_resultado:   params.resultado?.length ? params.resultado : null,
    p_asignado_a:  params.asignado_a || null,
    p_fecha_desde: params.fecha_desde || null,
    p_fecha_hasta: params.fecha_hasta || null,
    p_limit:       pageSize,
    p_offset:      (page - 1) * pageSize,
  })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}
