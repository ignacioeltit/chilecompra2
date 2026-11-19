/**
 * POST /api/conciliacion
 * Corre el algoritmo sobre los movimientos de una cuenta aún no conciliados
 * y guarda los calces en la tabla `conciliaciones`.
 *
 * POST /api/conciliacion/confirmar
 * Confirma calces `exacta` en lote o uno específico: escribe facturas.fecha_pago.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { conciliar, MovimientoBancario, FacturaCandidato } from '@/lib/conciliacion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any

async function getAuthClients(req: NextRequest): Promise<
  { error: NextResponse } | { supabase: SbClient; orgId: string; userId: string }
> {
  void req
  const serverClient = await createServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const { data: perfil } = await serverClient
    .from('usuarios').select('org_id, rol').eq('id', user.id).single()
  if (!perfil || !['admin', 'editor'].includes(perfil.rol)) {
    return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }

  const supabase: SbClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return { supabase, orgId: perfil.org_id, userId: user.id }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthClients(req)
  if ('error' in auth) return auth.error
  const { supabase, orgId } = auth

  const body = await req.json() as { cuenta_id?: string; importacion_id?: string }
  const cuentaId = body.cuenta_id
  if (!cuentaId) return NextResponse.json({ error: 'Falta cuenta_id' }, { status: 400 })

  // Movimientos aún sin conciliar de esta cuenta
  const { data: movRows } = await supabase
    .from('movimientos_bancarios')
    .select('id, fecha, descripcion, abono, cargo')
    .eq('org_id', orgId)
    .eq('cuenta_id', cuentaId)
    .gt('abono', 0)
    .not('id', 'in', `(select movimiento_id from conciliaciones where org_id = '${orgId}')`)

  const movimientos: MovimientoBancario[] = (movRows ?? []).map((r: Record<string,unknown>) => ({
    id:          r.id as string,
    fecha:       r.fecha as string,
    descripcion: (r.descripcion as string) ?? '',
    abono:       r.abono as number | null,
    cargo:       r.cargo as number | null,
  }))

  // Facturas impagas de la org
  const { data: facRows } = await supabase
    .from('facturas')
    .select('id, monto, fecha_emision, fecha_pago')
    .eq('org_id', orgId)
    .is('fecha_pago', null)

  const facturas: FacturaCandidato[] = (facRows ?? []).map((r: Record<string,unknown>) => ({
    id:                  r.id as string,
    monto:               r.monto as number,
    fechaEmision:        r.fecha_emision as string,
    rutReceptor:         null,
    razonSocialReceptor: null,
    pagoFecha:           null,
  }))

  const calces = conciliar(movimientos, facturas)

  if (calces.length === 0) {
    return NextResponse.json({ ok: true, calces: 0, insertados: 0 })
  }

  // Guardar calces en conciliaciones
  const rows = calces.flatMap(c =>
    c.facturaIds.map(fid => ({
      org_id:         orgId,
      movimiento_id:  c.movimientoId,
      factura_id:     fid,
      monto_aplicado: Math.round(c.montoAplicado / c.facturaIds.length),
      tipo:           c.tipo,
      confianza:      c.confianza,
    }))
  )

  const { error: insErr, count } = await supabase
    .from('conciliaciones')
    .upsert(rows, { onConflict: 'movimiento_id,factura_id', ignoreDuplicates: true })
    .select('id', { count: 'exact', head: true })

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, calces: calces.length, insertados: count ?? 0 })
}
