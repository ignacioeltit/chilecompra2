/**
 * POST /api/conciliacion/confirmar
 * Body: { ids: string[] }  — ids de conciliaciones a confirmar
 *       o { exactas: true, cuenta_id: string } — confirmar todas las exactas de una cuenta
 *
 * Efecto: escribe facturas.fecha_pago y metodo_pago, marca confirmado_por/en.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any

export async function POST(req: NextRequest) {
  const serverClient = await createServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await serverClient
    .from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || !['admin', 'editor'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const supabase: SbClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const body = await req.json() as { ids?: string[]; exactas?: boolean; cuenta_id?: string }

  let concIds: string[] = []

  if (body.exactas && body.cuenta_id) {
    // Todas las exactas de la cuenta aún no confirmadas
    const { data } = await supabase
      .from('conciliaciones')
      .select('id')
      .eq('org_id', perfil.org_id)
      .eq('confianza', 'exacta')
      .is('confirmado_por', null)
      .in('movimiento_id', supabase
        .from('movimientos_bancarios')
        .select('id')
        .eq('cuenta_id', body.cuenta_id)
      )
    concIds = (data ?? []).map((r: { id: string }) => r.id)
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    concIds = body.ids
  }

  if (concIds.length === 0) {
    return NextResponse.json({ ok: true, confirmadas: 0 })
  }

  // Cargar conciliaciones con sus movimientos y facturas
  const { data: concs } = await supabase
    .from('conciliaciones')
    .select('id, factura_id, tipo, movimiento_id, movimientos_bancarios(fecha)')
    .in('id', concIds)
    .eq('org_id', perfil.org_id)
    .is('confirmado_por', null)

  if (!concs || concs.length === 0) {
    return NextResponse.json({ ok: true, confirmadas: 0 })
  }

  let confirmadas = 0
  const now = new Date().toISOString()

  for (const c of concs) {
    const fecha = c.movimientos_bancarios?.fecha ?? null
    const metodoPago = c.tipo === 'factoring' ? 'Factoring' : 'Transferencia'

    // Actualizar factura
    const { data: upd } = await supabase
      .from('facturas')
      .update({ fecha_pago: fecha, metodo_pago: metodoPago })
      .eq('id', c.factura_id)
      .eq('org_id', perfil.org_id)
      .is('fecha_pago', null)   // no pisar si ya fue pagada por otra vía
      .select('id')

    if (upd && upd.length > 0) {
      // Marcar conciliación como confirmada
      await supabase
        .from('conciliaciones')
        .update({ confirmado_por: user.id, confirmado_en: now })
        .eq('id', c.id)
      confirmadas++
    }
  }

  // Señal al dashboard para que recargue
  return NextResponse.json({ ok: true, confirmadas })
}
