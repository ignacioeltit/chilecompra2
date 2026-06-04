'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function crearInstitucion(nombre: string, region?: string, rut?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol === 'lector') return { error: 'Sin permisos' }

  const { data, error } = await supabase
    .from('instituciones')
    .insert({ org_id: perfil.org_id, nombre: nombre.trim(), region: region?.trim() || null, rut: rut?.trim() || null })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/config')
  return { id: data.id }
}

export async function actualizarInstitucion(id: string, nombre: string, region?: string, rut?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol === 'lector') return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('instituciones')
    .update({ nombre: nombre.trim(), region: region?.trim() || null, rut: rut?.trim() || null })
    .eq('id', id).eq('org_id', perfil.org_id)

  if (error) return { error: error.message }
  revalidatePath('/config')
  return { ok: true }
}

export async function eliminarInstitucion(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') return { error: 'Solo administradores' }

  const { error } = await supabase
    .from('instituciones').delete().eq('id', id).eq('org_id', perfil.org_id)

  if (error) return { error: error.message }
  revalidatePath('/config')
  return { ok: true }
}
