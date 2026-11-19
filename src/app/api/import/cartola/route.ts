import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseCartolaBancoEstado } from '@/lib/parsers/cartola-be'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
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

  // ── Parsear archivo ───────────────────────────────────────
  const formData = await req.formData()
  const file = formData.get('archivo') as File | null
  const cuentaId = formData.get('cuenta_id') as string | null

  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!cuentaId) return NextResponse.json({ error: 'Falta cuenta_id' }, { status: 400 })

  // Verificar que la cuenta pertenece a la org
  const { data: cuenta } = await supabase
    .from('cuentas_bancarias').select('id').eq('id', cuentaId).eq('org_id', perfil.org_id).maybeSingle()
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  let cartola
  try {
    const buffer = await file.arrayBuffer()
    cartola = parseCartolaBancoEstado(buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al parsear el archivo'
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  if (cartola.filas.length === 0) {
    return NextResponse.json({ error: 'No se encontraron movimientos en el archivo' }, { status: 422 })
  }

  // ── Registrar importación ─────────────────────────────────
  const { data: importacion, error: impErr } = await supabase
    .from('importaciones')
    .insert({
      org_id:         perfil.org_id,
      tipo:           'cartola',
      archivo_nombre: file.name,
      periodo_desde:  cartola.periodoDesde,
      periodo_hasta:  cartola.periodoHasta,
      filas:          cartola.filas.length,
      creado_por:     user.id,
    })
    .select('id')
    .single()

  if (impErr) {
    return NextResponse.json({ error: `Error al registrar importación: ${impErr.message}` }, { status: 500 })
  }

  // ── Insertar movimientos (upsert — reimportar no duplica) ─
  const rows = cartola.filas.map(f => ({
    org_id:         perfil.org_id,
    cuenta_id:      cuentaId,
    importacion_id: importacion.id,
    fecha:          f.fecha,
    n_operacion:    f.nOperacion || null,
    descripcion:    f.descripcion,
    cargo:          f.cargo,
    abono:          f.abono,
    saldo:          f.saldo,
    n_cartola:      cartola.nCartola,
  }))

  const { error: movErr, count } = await supabase
    .from('movimientos_bancarios')
    .upsert(rows, { onConflict: 'cuenta_id,fecha,n_operacion,cargo,abono', ignoreDuplicates: true })
    .select('id', { count: 'exact', head: true })

  if (movErr) {
    return NextResponse.json({ error: `Error al insertar movimientos: ${movErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    importacionId: importacion.id,
    filasParsed:   cartola.filas.length,
    filasInserted: count ?? 0,
    periodoDesde:  cartola.periodoDesde,
    periodoHasta:  cartola.periodoHasta,
  })
}
