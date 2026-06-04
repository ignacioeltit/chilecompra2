import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const codigos: string[] = Array.isArray(body.codigos) ? body.codigos : []

    if (!codigos.length) return NextResponse.json({ deleted: 0 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('org_id, rol')
      .eq('id', user.id)
      .single()

    if (!perfil || perfil.rol !== 'admin')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Borrar las licitaciones para este org con los codigos indicados
    const { data, error } = await supabase
      .from('licitaciones')
      .delete()
      .in('codigo_chilecompra', codigos)
      .eq('org_id', perfil.org_id)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const deleted = Array.isArray(data) ? data.length : 0
    return NextResponse.json({ deleted })
  } catch (err) {
    console.error('[import/delete] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
