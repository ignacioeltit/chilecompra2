import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/instituciones/completar
// Enlaza licitaciones con institucion_id = null usando el texto del campo institucion.
// Si la institución no existe en el maestro la crea.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios').select('org_id, rol').eq('id', user.id).single()
    if (!perfil || perfil.rol !== 'admin')
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

    // 1. Buscar licitaciones con institucion_id nulo pero con nombre de institución
    const { data: sinEnlace, error: errBuscar } = await supabase
      .from('licitaciones')
      .select('id, institucion')
      .eq('org_id', perfil.org_id)
      .is('institucion_id', null)
      .not('institucion', 'is', null)
      .neq('institucion', '')

    if (errBuscar) return NextResponse.json({ error: errBuscar.message }, { status: 500 })
    if (!sinEnlace || sinEnlace.length === 0)
      return NextResponse.json({ completadas: 0, creadas: 0, mensaje: 'Todas las licitaciones ya tienen institución enlazada.' })

    let completadas = 0
    let creadas = 0
    const detalles: { id: string; institucion: string; accion: string }[] = []

    for (const lic of sinEnlace) {
      const nombre = lic.institucion.trim()
      if (!nombre) continue

      // 2. Buscar institución existente (primer match, evitamos .single() que falla con duplicados)
      const { data: matches } = await supabase
        .from('instituciones')
        .select('id, nombre')
        .eq('org_id', perfil.org_id)
        .ilike('nombre', nombre)
        .limit(1)

      let instId: string

      if (matches && matches.length > 0) {
        instId = matches[0].id
        detalles.push({ id: lic.id, institucion: nombre, accion: 'enlazada' })
      } else {
        // 3. Crear institución si no existe
        const { data: nueva, error: errCrear } = await supabase
          .from('instituciones')
          .insert({ org_id: perfil.org_id, nombre })
          .select('id')
          .single()

        if (errCrear || !nueva) {
          detalles.push({ id: lic.id, institucion: nombre, accion: `error: ${errCrear?.message}` })
          continue
        }
        instId = nueva.id
        creadas++
        detalles.push({ id: lic.id, institucion: nombre, accion: 'creada y enlazada' })
      }

      // 4. Actualizar la licitación
      const { error: errUpdate } = await supabase
        .from('licitaciones')
        .update({ institucion_id: instId })
        .eq('id', lic.id)
        .eq('org_id', perfil.org_id)

      if (!errUpdate) completadas++
    }

    return NextResponse.json({
      total: sinEnlace.length,
      completadas,
      creadas,
      detalles,
    })
  } catch (err) {
    console.error('[instituciones/completar]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
