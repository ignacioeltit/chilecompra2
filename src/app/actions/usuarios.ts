'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { type RolUsuario } from '@/types'

// ── Invitar usuario por email ──
export async function invitarUsuario(email: string, rol: RolUsuario) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') return { error: 'Solo administradores pueden invitar' }

  // Crear usuario en Supabase Auth (magiclink / invite)
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { org_id: perfil.org_id, rol },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })
  if (error) return { error: error.message }

  // Crear perfil en tabla usuarios
  const { error: perfilErr } = await supabase.from('usuarios').upsert({
    id:     data.user.id,
    org_id: perfil.org_id,
    email,
    rol,
  })
  if (perfilErr) return { error: perfilErr.message }

  revalidatePath('/config')
  return { ok: true }
}

// ── Cambiar rol ──
export async function cambiarRol(userId: string, nuevoRol: RolUsuario) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') return { error: 'Solo administradores' }

  const { error } = await supabase
    .from('usuarios').update({ rol: nuevoRol })
    .eq('id', userId).eq('org_id', perfil.org_id)

  if (error) return { error: error.message }
  revalidatePath('/config')
  return { ok: true }
}

// ── Eliminar usuario ──
export async function eliminarUsuario(userId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (user.id === userId) return { error: 'No puedes eliminarte a ti mismo' }

  const { data: perfil } = await supabase.from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') return { error: 'Solo administradores' }

  const { error } = await supabase.from('usuarios').delete().eq('id', userId).eq('org_id', perfil.org_id)
  if (error) return { error: error.message }

  revalidatePath('/config')
  return { ok: true }
}

// ── Actualizar preferencias de notificación ──
export async function actualizarPreferencias(prefs: {
  notif_urgente?: boolean
  notif_pronto?: boolean
  notif_resultado?: boolean
  notif_email?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('usuarios').update(prefs).eq('id', user.id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Guardar suscripción push ──
export async function guardarSuscripcionPush(subscription: PushSubscriptionJSON) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('usuarios')
    .update({ push_subscription: subscription })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}
