import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchCOT, fetchLicitaciones, type ItemSync } from '@/lib/mp-api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbClient = any

const REGIONES = ['16'] // Solo Región del Ñuble
const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'para', 'por',
  'un', 'una', 'y', 'e', 'o', 'a', 'se', 'que', 'lo', 'al',
  'servicio', 'servicios', 'contrato', 'provision', 'provisión',
  'adquisicion', 'adquisición', 'suministro', 'compra', 'ágil',
])
const ESTADOS_EXCLUIDOS = ['no_participe', 'cancelada']

/** Extrae palabras clave de los nombres de licitaciones activas */
function buildKeywordProfile(nombres: string[]): Set<string> {
  const freq: Record<string, number> = {}
  for (const nombre of nombres) {
    const words = nombre
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1
    }
  }
  return new Set(
    Object.entries(freq)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([w]) => w)
  )
}

/** Verifica si un nombre de licitación coincide con al menos una keyword */
function matchesProfile(nombre: string, keywords: Set<string>): boolean {
  if (keywords.size === 0) return false
  const normalized = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
  for (const kw of keywords) {
    if (normalized.includes(kw)) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  // ── Autenticación: CRON_SECRET o sesión admin ────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const esCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  let orgId: string
  let supabase: SbClient
  let creadoPor: string

  if (esCron) {
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const rut = process.env.MP_RUT_PROVEEDOR ?? ''
    if (!rut) return NextResponse.json({ error: 'MP_RUT_PROVEEDOR no configurado' }, { status: 500 })
    const { data: orgRow } = await supabase.from('organizaciones').select('id').eq('rut', rut).maybeSingle()
    if (!orgRow) return NextResponse.json({ error: `Org con rut ${rut} no encontrada` }, { status: 404 })
    orgId = orgRow.id
    // Usar usuario admin para creado_por
    const { data: adminRow } = await supabase
      .from('usuarios').select('id').eq('org_id', orgId).eq('rol', 'admin').maybeSingle()
    if (!adminRow) return NextResponse.json({ error: 'No se encontró usuario admin' }, { status: 500 })
    creadoPor = adminRow.id
  } else {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: perfil } = await serverClient
      .from('usuarios').select('org_id, rol').eq('id', user.id).single()
    if (!perfil || perfil.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }
    orgId = perfil.org_id
    creadoPor = user.id
    supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  const MP_API_KEY = process.env.MP_BUSCADOR_API_KEY ?? ''
  const MP_TICKET  = process.env.MP_TICKET ?? ''

  // ── Construir perfil de keywords ─────────────────────────────
  const { data: licsActivas } = await supabase
    .from('licitaciones')
    .select('nombre')
    .eq('org_id', orgId)
    .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.map(e => `"${e}"`).join(',')})`)

  const keywords = buildKeywordProfile((licsActivas ?? []).map((r: { nombre: string }) => r.nombre))
  console.log(`[auto-sync] Keywords (${keywords.size}):`, [...keywords].join(', '))

  // ── Buscar licitaciones nuevas de las últimas 2 horas ────────
  const ahora = new Date()
  const hace2h = new Date(ahora.getTime() - 2 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const [cotItems, licItems] = await Promise.all([
    MP_API_KEY
      ? fetchCOT(fmt(hace2h), fmt(ahora), REGIONES, MP_API_KEY).catch(() => [] as ItemSync[])
      : Promise.resolve([] as ItemSync[]),
    MP_TICKET
      ? fetchLicitaciones(MP_TICKET, REGIONES).catch(() => [] as ItemSync[])
      : Promise.resolve([] as ItemSync[]),
  ])

  const candidatos = [...cotItems, ...licItems]
  console.log(`[auto-sync] Candidatos obtenidos: ${candidatos.length}`)

  // ── Filtrar por keywords ──────────────────────────────────────
  const relevantes = keywords.size === 0
    ? candidatos // sin perfil aún: importar todo
    : candidatos.filter(item => matchesProfile(item.nombre, keywords))

  console.log(`[auto-sync] Relevantes: ${relevantes.length}`)

  if (relevantes.length === 0) {
    return NextResponse.json({ importadas: 0, candidatos: candidatos.length, keywords: keywords.size })
  }

  // ── Excluir ya importadas ─────────────────────────────────────
  const codigos = relevantes.map(r => r.codigo)
  const { data: existentes } = await supabase
    .from('licitaciones')
    .select('codigo_chilecompra')
    .eq('org_id', orgId)
    .in('codigo_chilecompra', codigos)
  const yaExisten = new Set((existentes ?? []).map((r: { codigo_chilecompra: string }) => r.codigo_chilecompra))

  const nuevas = relevantes.filter(r => !yaExisten.has(r.codigo))
  console.log(`[auto-sync] Nuevas a importar: ${nuevas.length}`)

  if (nuevas.length === 0) {
    return NextResponse.json({ importadas: 0, candidatos: candidatos.length, relevantes: relevantes.length, keywords: keywords.size })
  }

  // ── Importar ──────────────────────────────────────────────────
  const rows = nuevas.map(item => ({
    org_id:            orgId,
    codigo_chilecompra: item.codigo,
    nombre:            item.nombre,
    descripcion:       item.descripcion ?? null,
    estado:            'sin_definir',
    resultado:         null,
    fecha_publicacion: item.fecha_publicacion,
    fecha_cierre_1:    item.fecha_cierre,
    fecha_cierre_2:    null,
    institucion:       item.organismo,
    institucion_id:    null,
    monto_clp:         item.monto,
    creado_por:        creadoPor,
  }))

  const { data: inserted, error } = await supabase
    .from('licitaciones')
    .insert(rows)
    .select('id, codigo_chilecompra')

  if (error) {
    console.error('[auto-sync] Error al insertar:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[auto-sync] Importadas: ${inserted?.length ?? 0}`)
  return NextResponse.json({
    importadas: inserted?.length ?? 0,
    candidatos: candidatos.length,
    relevantes: relevantes.length,
    keywords: keywords.size,
    codigos: (inserted ?? []).map((r: { codigo_chilecompra: string }) => r.codigo_chilecompra),
  })
}
