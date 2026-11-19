import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseCLP } from '@/lib/clp'

const MP_OC_URL  = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json'
const MP_EMP_URL = 'https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor'

// Fecha mínima de sincronización (primera carga histórica)
const INICIO_SYNC = '2026-05-01'

// Extrae el código de cotización (ej: "1062807-73-COT26") del nombre de una OC
const COT_REGEX = /(\d{7}-\d+-COT\d{2})/i

// Alias no tipado para operaciones en tablas/columnas nuevas (aún no en los tipos generados)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Convierte un Date a DDMMAAAA requerido por la API de MP */
function toFechaMP(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}${mm}${d.getFullYear()}`
}

/** Normaliza un RUT chileno para comparación: quita puntos, deja guion */
function normRut(rut: string | null | undefined): string {
  if (!rut) return ''
  return rut.replace(/\./g, '').trim().toLowerCase()
}

/** Redacta el ticket de las URLs antes de loguear */
function redactUrl(url: string): string {
  return url.replace(/ticket=[^&\s]*/gi, 'ticket=[REDACTED]')
}

/** Consulta o descubre el CodigoEmpresa del proveedor en MP */
async function resolverCodigoProveedor(
  supabase: SbClient,
  orgId: string,
  rut: string,
  ticket: string,
): Promise<string | null> {
  const { data: org } = await supabase
    .from('organizaciones')
    .select('mp_codigo_proveedor')
    .eq('id', orgId)
    .single()

  const cached = (org as { mp_codigo_proveedor?: string | null } | null)?.mp_codigo_proveedor
  if (cached) return cached

  // Llamar a BuscarProveedor para obtener CodigoEmpresa
  const url = `${MP_EMP_URL}?rutempresaproveedor=${encodeURIComponent(rut)}&ticket=${ticket}`
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10000) })
    const json = await res.json()
    const codigo = String(json.Listado?.[0]?.CodigoEmpresa ?? '')
    if (!codigo) return null
    // Guardar para futuras llamadas
    await supabase.from('organizaciones').update({ mp_codigo_proveedor: codigo }).eq('id', orgId)
    return codigo
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sync/oc] BuscarProveedor error:', msg.replace(/https?:\/\/[^\s]*/g, '[URL]'))
    return null
  }
}

/** Fecha de inicio de sync: último sincronizado_en o INICIO_SYNC */
async function resolverFechaInicio(supabase: SbClient, orgId: string): Promise<Date> {
  const { data } = await supabase
    .from('ordenes_compra')
    .select('sincronizado_en')
    .eq('org_id', orgId)
    .order('sincronizado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.sincronizado_en) {
    // Retroceder 1 día para no perder OC del último día sincronizado
    const d = new Date(data.sincronizado_en)
    d.setDate(d.getDate() - 1)
    return new Date(d.toISOString().slice(0, 10)) // medianoche UTC
  }
  return new Date(INICIO_SYNC)
}

export async function POST(req: NextRequest) {
  const ticket = process.env.MP_TICKET ?? ''
  if (!ticket) {
    return NextResponse.json({ error: 'MP_TICKET no configurado' }, { status: 500 })
  }

  // ── Autenticación: CRON_SECRET o sesión admin ────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const esCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  let orgId: string
  let supabase: SbClient

  if (esCron) {
    // Llamada desde cron: usar service role (bypasa RLS)
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as SbClient
    // Buscar org que coincida con el RUT configurado
    const rut = process.env.MP_RUT_PROVEEDOR ?? ''
    if (!rut) {
      return NextResponse.json({ error: 'MP_RUT_PROVEEDOR no configurado' }, { status: 500 })
    }
    const { data: orgRow } = await supabase
      .from('organizaciones')
      .select('id')
      .eq('rut', rut)
      .maybeSingle()
    if (!orgRow) {
      return NextResponse.json({ error: `Org con rut ${rut} no encontrada` }, { status: 404 })
    }
    orgId = orgRow.id
  } else {
    // Llamada desde browser: verificar sesión admin
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: perfil } = await serverClient
      .from('usuarios').select('org_id, rol').eq('id', user.id).single()
    if (!perfil || perfil.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }
    orgId = perfil.org_id
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as SbClient
  }

  // ── Resolver RUT y CodigoProveedor ───────────────────────────
  const { data: orgData } = await supabase
    .from('organizaciones')
    .select('rut, mp_codigo_proveedor')
    .eq('id', orgId)
    .single()

  const rut = (orgData as { rut?: string | null } | null)?.rut
    ?? process.env.MP_RUT_PROVEEDOR
    ?? ''
  if (!rut) {
    return NextResponse.json({ error: 'RUT de proveedor no configurado en la organización' }, { status: 400 })
  }

  const codigoProveedor = await resolverCodigoProveedor(supabase, orgId, rut, ticket)
  if (!codigoProveedor) {
    return NextResponse.json({ error: 'No se pudo obtener código de proveedor de Mercado Público' }, { status: 502 })
  }

  // ── Iterar días ──────────────────────────────────────────────
  const fechaInicio = await resolverFechaInicio(supabase, orgId)
  const hoy = new Date()
  const alertas: string[] = []
  let upsertadas = 0
  let errores = 0

  const cur = new Date(fechaInicio)
  while (cur <= hoy) {
    const fechaStr = toFechaMP(cur)
    await sleep(300) // respetar límites de la API

    let listado: Record<string, unknown>[]
    try {
      const url = `${MP_OC_URL}?fecha=${fechaStr}&CodigoProveedor=${codigoProveedor}&ticket=${ticket}`
      const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(12000) })
      if (!res.ok) { cur.setDate(cur.getDate() + 1); continue }
      const json = await res.json()
      if (json.Codigo && json.Codigo !== 200) { cur.setDate(cur.getDate() + 1); continue }
      listado = Array.isArray(json.Listado) ? json.Listado : []
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[sync/oc] listado error', fechaStr, msg.replace(/https?:\/\/[^\s]*/g, '[URL]'))
      cur.setDate(cur.getDate() + 1)
      continue
    }

    for (const oc of listado) {
      const codigo = String(oc.CodigoOC ?? oc.Codigo ?? '').trim()
      if (!codigo) continue

      await sleep(150) // throttle entre detalles

      // Fetch detalle para obtener datos completos
      let det: Record<string, unknown> = {}
      try {
        const url = `${MP_OC_URL}?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`
        const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(12000) })
        if (res.ok) {
          const json = await res.json()
          det = (Array.isArray(json.Listado) ? json.Listado[0] : null) ?? {}
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[sync/oc] detalle error', codigo, msg.replace(/https?:\/\/[^\s]*/g, '[URL]'))
      }

      const nombre         = String(det.Nombre ?? oc.Nombre ?? '')
      const estadoMp       = String(det.Estado ?? oc.Estado ?? '')
      const fechaEnvioRaw  = String(det.FechaEnvioOrden ?? oc.FechaEnvioOrden ?? '').slice(0, 10)
      const fechaEnvio     = fechaEnvioRaw || cur.toISOString().slice(0, 10)
      const totalRaw       = det.Total ?? det.TotalNeto ?? oc.Total ?? oc.TotalNeto
      const total          = parseCLP(typeof totalRaw === 'number' ? totalRaw : String(totalRaw ?? ''))
      const compradorRut   = String(det.RutUnidad ?? oc.RutUnidad ?? det.RutComprador ?? oc.RutComprador ?? '')
      const compradorNombre = String(det.NombreUnidad ?? oc.NombreUnidad ?? det.NombreComprador ?? oc.NombreComprador ?? '')

      // Extraer código de cotización del nombre
      const cotMatch        = nombre.match(COT_REGEX)
      const cotizacionCodigo = cotMatch ? cotMatch[1].toUpperCase() : null

      // Asociar OC ↔ licitación
      let licitacionId: string | null = null
      if (cotizacionCodigo) {
        const { data: lit } = await supabase
          .from('licitaciones')
          .select('id, resultado, monto_clp, orden_compra, institucion_id, institucion')
          .eq('org_id', orgId)
          .eq('codigo_chilecompra', cotizacionCodigo)
          .maybeSingle()

        if (lit) {
          licitacionId = lit.id

          // Alerta si resultado ya fue definido por el usuario como algo distinto de 'ganada'
          if (lit.resultado !== null && lit.resultado !== 'ganada') {
            alertas.push(
              `OC ${codigo} ↔ ${cotizacionCodigo}: resultado actual '${lit.resultado}' — MP indica ganada`
            )
          }

          // Validación de comprador vs institución
          if (compradorRut && lit.institucion) {
            const { data: inst } = await supabase
              .from('instituciones')
              .select('rut, nombre')
              .eq('id', lit.institucion_id)
              .maybeSingle()

            if (inst?.rut && normRut(inst.rut) !== normRut(compradorRut)) {
              alertas.push(
                `OC ${codigo}: comprador RUT ${compradorRut} (${compradorNombre}) no coincide ` +
                `con institución de la licitación ${cotizacionCodigo} (${inst.nombre}, RUT ${inst.rut})`
              )
            }
          }

          // Setear datos en licitacion solo si están vacíos
          const updates: Record<string, unknown> = {}
          if (!lit.orden_compra)                       updates.orden_compra = codigo
          if (lit.resultado === null)                  updates.resultado    = 'ganada'
          if (!lit.monto_clp && total !== null)        updates.monto_clp    = total

          if (Object.keys(updates).length > 0) {
            await supabase.from('licitaciones').update(updates).eq('id', lit.id)
          }
        }
      }

      // Upsert OC
      const { error: uErr } = await supabase.from('ordenes_compra').upsert(
        {
          org_id:            orgId,
          codigo,
          estado_mp:         estadoMp,
          fecha_envio:       fechaEnvio,
          total,
          comprador_rut:     compradorRut || null,
          comprador_nombre:  compradorNombre || null,
          nombre:            nombre || null,
          cotizacion_codigo: cotizacionCodigo,
          licitacion_id:     licitacionId,
          raw:               { ...oc, ...det },
          sincronizado_en:   new Date().toISOString(),
        },
        { onConflict: 'org_id,codigo' }
      )

      if (uErr) {
        errores++
        console.error('[sync/oc] upsert error', codigo, uErr.message)
      } else {
        upsertadas++
      }
    }

    cur.setDate(cur.getDate() + 1)
  }

  return NextResponse.json({
    ok: true,
    upsertadas,
    errores,
    alertas,
    desde: fechaInicio.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  })
}
