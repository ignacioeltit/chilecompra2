import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fromZonedTime } from 'date-fns-tz'

const TZ = 'America/Santiago'

// ── Buscador (Compras ágiles / COT) ──────────────────────────
const MP_AUTH_URL    = 'https://servicios-prd.mercadopublico.cl/v1/auth/publico'
const MP_SEARCH_URL  = 'https://api.buscador.mercadopublico.cl/compra-agil'
const MP_API_KEY     = 'e93089e4-437c-4723-b343-4fa20045e3bc'

// ── API oficial (LE / LP / LR / L1) ─────────────────────────
const MP_API_URL     = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json'

const REGIONES_DEFAULT = ['16'] // Ñuble

// Tipo unificado para mostrar en la UI
export interface ItemSync {
  codigo: string
  nombre: string
  descripcion: string | null
  fecha_publicacion: string | null // ISO, null si el formato no fue reconocido
  fecha_cierre: string | null      // ISO
  organismo: string
  monto: number | null
  tipo: 'COT' | 'LE' | 'LP' | 'LR' | 'L1' | 'LC'
  region?: string // código numérico de región MP
}

// "2026-06-02 15:39" → ISO Chile
// Convierte cualquier formato de fecha de Mercado Público a UTC ISO string.
// Nunca hardcodea el offset — usa fromZonedTime para respetar horario de verano/invierno.
function parseFechaMP(s: string | null | undefined): string | null {
  if (!s) return null

  // Ya es un ISO con timezone (UTC o con offset): parsear directo sin re-convertir
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Formato buscador: "2026-06-02 16:49" (YYYY-MM-DD HH:MM, hora Chile local)
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (m1) return fromZonedTime(`${m1[1]}-${m1[2]}-${m1[3]}T${m1[4]}:${m1[5]}:00`, TZ).toISOString()

  // Formato API oficial ISO sin offset: "2026-06-02T16:41:22.677" (hora Chile local)
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  if (m2) return fromZonedTime(m2[1], TZ).toISOString()

  // Formato API oficial chileno: "03-06-2026 9:02:58" (DD-MM-YYYY H:MM:SS, hora Chile local)
  const m3 = s.match(/^(\d{1,2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m3) {
    const local = `${m3[3]}-${m3[2]}-${m3[1].padStart(2, '0')}T${m3[4].padStart(2, '0')}:${m3[5]}:${m3[6] ?? '00'}`
    return fromZonedTime(local, TZ).toISOString()
  }

  return null
}

function parseFechaISO(s: string | null | undefined): Date | null {
  const iso = parseFechaMP(s)
  return iso ? new Date(iso) : null
}

function tipoDesdeCodigoExterno(codigo: string): ItemSync['tipo'] {
  const m = codigo.match(/-(L[A-Z0-9]+|CO[A-Z]?\d*)$/i)
  if (!m) return 'COT'
  const t = m[1].replace(/\d+$/, '').toUpperCase()
  if (t === 'L1') return 'L1'
  if (t === 'LE') return 'LE'
  if (t === 'LP') return 'LP'
  if (t === 'LR') return 'LR'
  if (t === 'LC') return 'LC'
  return 'COT'
}

// ── Fetch COT desde buscador ─────────────────────────────────
async function fetchCOT(dateFrom: string, dateTo: string, regiones: string[]): Promise<ItemSync[]> {
  const tokenRes = await fetch(MP_AUTH_URL, {
    headers: { 'Accept': 'application/json', 'Origin': 'https://buscador.mercadopublico.cl' },
    next: { revalidate: 0 },
  })
  const token = (await tokenRes.json()).payload.access_token

  const fetchRegion = async (region: string): Promise<ItemSync[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom, date_to: dateTo,
      order_by: 'recent', region, status: '2', page_number: '1',
    })

    const fetchPag = async (page: number) => {
      params.set('page_number', String(page))
      const res = await fetch(`${MP_SEARCH_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': MP_API_KEY,
          'Accept': 'application/json',
          'Origin': 'https://buscador.mercadopublico.cl',
        },
        next: { revalidate: 0 },
      })
      const json = await res.json()
      return { resultados: json.payload?.resultados ?? [], pageCount: json.payload?.pageCount ?? 1 }
    }

    const primera = await fetchPag(1)
    let todas = [...primera.resultados]
    for (let p = 2; p <= Math.min(primera.pageCount, 10); p++) {
      todas = todas.concat((await fetchPag(p)).resultados)
    }

    return todas.map((r: Record<string, unknown>) => ({
      codigo:            String(r.codigo),
      nombre:            String(r.nombre ?? ''),
      descripcion:       null,
      fecha_publicacion: parseFechaMP(r.fecha_publicacion as string) ?? null,
      fecha_cierre:      parseFechaMP(r.fecha_cierre as string),
      organismo:         String(r.organismo ?? ''),
      monto:             typeof r.monto_disponible_CLP === 'number' ? r.monto_disponible_CLP : null,
      tipo:              'COT' as const,
      region,
    }))
  }

  const resultados = await Promise.all(regiones.map(r => fetchRegion(r).catch(() => [] as ItemSync[])))
  const vistos = new Set<string>()
  return resultados.flat().filter(item => {
    if (vistos.has(item.codigo)) return false
    vistos.add(item.codigo)
    return true
  })
}

// ── Fetch LE/LP/LR/L1 desde API oficial ─────────────────────
async function fetchLicitaciones(ticket: string, regiones: string[]): Promise<ItemSync[]> {
  const fetchRegion = async (region: string): Promise<ItemSync[]> => {
    const res = await fetch(
      `${MP_API_URL}?ticket=${ticket}&estado=publicada&region=${region}`,
      { next: { revalidate: 0 } }
    )
    const json = await res.json()
    if (json.Codigo && json.Codigo !== 200) return []

    return (json.Listado ?? []).map((r: Record<string, unknown>) => {
      const fechas = r.Fechas as Record<string, string> | null
      const comprador = r.Comprador as Record<string, string> | null
      return {
        codigo:            String(r.CodigoExterno ?? ''),
        nombre:            String(r.Nombre ?? ''),
        descripcion:       r.Descripcion ? String(r.Descripcion) : null,
        fecha_publicacion: parseFechaMP(fechas?.FechaPublicacion) ?? null,
        fecha_cierre:      parseFechaMP(fechas?.FechaCierre),
        organismo:         String(comprador?.NombreOrganismo ?? comprador?.NombreUnidad ?? ''),
        monto:             typeof r.MontoEstimado === 'number' ? r.MontoEstimado : null,
        tipo:              tipoDesdeCodigoExterno(String(r.CodigoExterno ?? '')),
        region,
      }
    })
  }

  const resultados = await Promise.all(regiones.map(r => fetchRegion(r).catch(() => [] as ItemSync[])))
  const vistos = new Set<string>()
  return resultados.flat().filter(item => {
    if (vistos.has(item.codigo)) return false
    vistos.add(item.codigo)
    return true
  })
}

// ── Buscar por código específico ─────────────────────────────
async function fetchPorCodigo(codigo: string, ticket: string): Promise<ItemSync | null> {
  const tipo = tipoDesdeCodigoExterno(codigo)

  if (tipo === 'COT') {
    // El buscador no permite buscar por código directamente — q busca en el nombre.
    // Estrategia: pedir últimos 60 días (todas las páginas) y filtrar por código exacto.
    try {
      const tokenRes = await fetch(MP_AUTH_URL, {
        headers: { 'Accept': 'application/json', 'Origin': 'https://buscador.mercadopublico.cl' },
        next: { revalidate: 0 },
      })
      const token = (await tokenRes.json()).payload.access_token

      const hoy = new Date()
      const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

      // Inferir año desde el código (COT25 → 2025, COT26 → 2026)
      const matchAnio = codigo.match(/COT(\d{2})$/i)
      const anioInferido = matchAnio ? 2000 + parseInt(matchAnio[1]) : hoy.getFullYear()

      // El buscador no mantiene archivo histórico. Si el código es de un año anterior
      // al actual, no existe en el índice → retornar null de inmediato.
      if (anioInferido < hoy.getFullYear()) return null

      // Para el año actual, buscar en los últimos 90 días (rápido y confiable)
      const dateFrom = new Date(hoy.getTime() - 90 * 86400000)
      const dateTo = hoy

      const codigoNorm = codigo.trim().toUpperCase()
      const headers = {
        'Authorization': `Bearer ${token}`,
        'x-api-key': MP_API_KEY,
        'Accept': 'application/json',
        'Origin': 'https://buscador.mercadopublico.cl',
      }

      for (let page = 1; page <= 20; page++) {
        const params = new URLSearchParams({
          date_from: fmt(dateFrom), date_to: fmt(dateTo),
          order_by: 'recent', page_number: String(page),
        })
        const res = await fetch(`${MP_SEARCH_URL}?${params}`, { headers, next: { revalidate: 0 } })
        const json = await res.json()
        const resultados: Record<string, unknown>[] = json.payload?.resultados ?? []
        const pageCount: number = json.payload?.pageCount ?? 1

        const r = resultados.find(x => String(x.codigo ?? '').trim().toUpperCase() === codigoNorm)
        if (r) {
          return {
            codigo:            String(r.codigo),
            nombre:            String(r.nombre ?? ''),
            descripcion:       null,
            fecha_publicacion: parseFechaMP(r.fecha_publicacion as string) ?? null,
            fecha_cierre:      parseFechaMP(r.fecha_cierre as string),
            organismo:         String(r.organismo ?? ''),
            monto:             typeof r.monto_disponible_CLP === 'number' ? r.monto_disponible_CLP : null,
            tipo:              'COT',
          }
        }
        if (page >= pageCount) break
      }
    } catch { /* ignorar */ }
    return null
  }

  // LE/LP/LR/L1 — API oficial por código
  if (!ticket) return null
  try {
    const res = await fetch(
      `${MP_API_URL}?ticket=${ticket}&codigo=${encodeURIComponent(codigo)}`,
      { next: { revalidate: 0 } }
    )
    const json = await res.json()
    const listado: Record<string, unknown>[] = json.Listado ?? []
    const r = listado[0]
    if (!r) return null
    const fechas = r.Fechas as Record<string, string> | null
    const comprador = r.Comprador as Record<string, string> | null
    return {
      codigo:            String(r.CodigoExterno ?? ''),
      nombre:            String(r.Nombre ?? ''),
      descripcion:       r.Descripcion ? String(r.Descripcion) : null,
      fecha_publicacion: parseFechaMP(fechas?.FechaPublicacion) ?? null,
      fecha_cierre:      parseFechaMP(fechas?.FechaCierre),
      organismo:         String(comprador?.NombreOrganismo ?? comprador?.NombreUnidad ?? ''),
      monto:             typeof r.MontoEstimado === 'number' ? r.MontoEstimado : null,
      tipo:              tipoDesdeCodigoExterno(String(r.CodigoExterno ?? '')),
    }
  } catch { return null }
}

// ── GET /api/sync ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios').select('org_id, rol').eq('id', user.id).single()
    if (!perfil || perfil.rol !== 'admin')
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

    const url = new URL(req.url)
    const codigoBuscar = url.searchParams.get('codigo')?.trim()
    const ticket = process.env.MP_TICKET ?? ''

    // Búsqueda por código único — retorna solo ese resultado
    if (codigoBuscar) {
      const item = await fetchPorCodigo(codigoBuscar, ticket)
      if (!item) return NextResponse.json({ error: 'No encontrada en Mercado Público' }, { status: 404 })
      // Verificar si ya existe
      const { data: existe } = await supabase.from('licitaciones').select('id')
        .eq('org_id', perfil.org_id).eq('codigo_chilecompra', item.codigo).maybeSingle()
      return NextResponse.json({ item, yaExiste: !!existe })
    }

    const dateTo = url.searchParams.get('date_to') ?? new Date().toISOString().slice(0, 10)
    const incluirAnteriores = url.searchParams.get('incluir_anteriores') === 'true'
    const regionesParam = url.searchParams.get('regiones')
    const regiones = regionesParam ? regionesParam.split(',').filter(Boolean) : REGIONES_DEFAULT

    // Leer marcas de tiempo separadas para COT y LE/LP
    let ultimaPublicacionCOT: Date | null = null
    let ultimaPublicacionLE: Date | null = null
    let tablaExiste = true
    try {
      const { data: estado, error } = await supabase
        .from('sync_estado').select('ultima_publicacion, ultima_publicacion_le')
        .eq('org_id', perfil.org_id).maybeSingle()
      if (error?.code === 'PGRST205') {
        tablaExiste = false
      } else {
        if (estado?.ultima_publicacion) ultimaPublicacionCOT = new Date(estado.ultima_publicacion)
        if (estado?.ultima_publicacion_le) ultimaPublicacionLE = new Date(estado.ultima_publicacion_le)
      }
    } catch { tablaExiste = false }

    // Convertir fecha a string Chile (YYYY-MM-DD) — evita desfase UTC
    const toChileDate = (d: Date) =>
      d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

    // dateFrom para query COT — si el usuario lo especifica explícitamente, usarlo
    const dateFromParam = url.searchParams.get('date_from')
    let dateFrom: string
    if (dateFromParam) {
      dateFrom = dateFromParam
    } else if (incluirAnteriores) {
      dateFrom = toChileDate(new Date(Date.now() - 30 * 86400000))
    } else if (ultimaPublicacionCOT) {
      dateFrom = toChileDate(ultimaPublicacionCOT)
    } else {
      dateFrom = dateTo
    }

    // Fetch en paralelo:
    // COT → usa date_from/date_to para filtrar por publicación
    // LE/LP → la API oficial devuelve solo las vigentes, no necesita rango de fechas
    const [cotItems, licItems] = await Promise.all([
      fetchCOT(dateFrom, dateTo, regiones).catch(() => [] as ItemSync[]),
      ticket ? fetchLicitaciones(ticket, regiones).catch(() => [] as ItemSync[]) : Promise.resolve([] as ItemSync[]),
    ])

    const todas: ItemSync[] = [...cotItems, ...licItems]

    // Excluir ya importadas
    const codigos = todas.map(c => c.codigo)
    const { data: existentes } = codigos.length
      ? await supabase.from('licitaciones').select('codigo_chilecompra')
          .eq('org_id', perfil.org_id).in('codigo_chilecompra', codigos)
      : { data: [] }

    const setExistentes = new Set(
      (existentes ?? []).map((e: { codigo_chilecompra: string }) => e.codigo_chilecompra)
    )
    const noImportadas = todas.filter(c => !setExistentes.has(c.codigo))

    // Filtro separado por tipo: COT usa su propia marca, LE/LP usan la suya
    const nuevas = (!incluirAnteriores)
      ? noImportadas.filter(c => {
          const pub = parseFechaISO(c.fecha_publicacion)
          if (pub === null) return true
          if (c.tipo === 'COT') return ultimaPublicacionCOT ? pub > ultimaPublicacionCOT : true
          return ultimaPublicacionLE ? pub > ultimaPublicacionLE : true
        })
      : noImportadas

    // Actualizar marcas de tiempo separadas
    if (tablaExiste) {
      const maxCOT = nuevas
        .filter(c => c.tipo === 'COT')
        .reduce<Date | null>((max, c) => {
          const pub = parseFechaISO(c.fecha_publicacion)
          return pub && (!max || pub > max) ? pub : max
        }, null)

      const maxLE = nuevas
        .filter(c => c.tipo !== 'COT')
        .reduce<Date | null>((max, c) => {
          const pub = parseFechaISO(c.fecha_publicacion)
          return pub && (!max || pub > max) ? pub : max
        }, null)

      const updates: Record<string, string> = { org_id: perfil.org_id }
      if (maxCOT && (!ultimaPublicacionCOT || maxCOT > ultimaPublicacionCOT))
        updates.ultima_publicacion = maxCOT.toISOString()
      if (maxLE && (!ultimaPublicacionLE || maxLE > ultimaPublicacionLE))
        updates.ultima_publicacion_le = maxLE.toISOString()

      if (Object.keys(updates).length > 1) {
        await supabase.from('sync_estado').upsert(updates, { onConflict: 'org_id' })
      }
    }

    return NextResponse.json({
      nuevas,
      yaExisten: setExistentes.size,
      ultimaPublicacion: ultimaPublicacionCOT?.toISOString() ?? null,
      ultimaPublicacionLE: ultimaPublicacionLE?.toISOString() ?? null,
      tablaExiste,
      total: todas.length,
    })
  } catch (err) {
    console.error('[sync] GET error', err)
    return NextResponse.json({ error: 'Error consultando Mercado Público' }, { status: 500 })
  }
}

// ── POST /api/sync ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios').select('org_id, rol').eq('id', user.id).single()
    if (!perfil || perfil.rol !== 'admin')
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

    const body = await req.json()
    const items: ItemSync[] = Array.isArray(body.items) ? body.items : []
    if (!items.length) return NextResponse.json({ importados: 0 })

    let importados = 0
    const errores: string[] = []

    for (const item of items) {
      const institucion = item.organismo?.trim() || 'Sin institución'

      let instId: string | null = null
      const { data: instExistente } = await supabase
        .from('instituciones').select('id')
        .eq('org_id', perfil.org_id).ilike('nombre', institucion).limit(1).maybeSingle()

      if (instExistente) {
        instId = instExistente.id
      } else {
        const { data: nueva } = await supabase
          .from('instituciones').insert({ org_id: perfil.org_id, nombre: institucion })
          .select('id').single()
        instId = nueva?.id ?? null
      }

      // Campos de metadatos que siempre se pueden actualizar sin afectar
      // el trabajo del usuario (nombre puede cambiar, fechas también).
      const metadatos = {
        nombre:            item.nombre,
        descripcion:       item.descripcion ?? null,
        fecha_cierre_1:    item.fecha_cierre ?? new Date(Date.now() + 7 * 86400000).toISOString(),
        fecha_publicacion: item.fecha_publicacion,
        institucion_id:    instId,
        institucion,
        monto_clp:         item.monto ?? null,
      }

      // 1. Intentar INSERT solo para licitaciones nuevas (ignorar si ya existe).
      //    Esto preserva estado/resultado que el usuario haya establecido.
      const { error: insertError } = await supabase.from('licitaciones').insert({
        ...metadatos,
        org_id:             perfil.org_id,
        codigo_chilecompra: item.codigo,
        estado:             'sin_definir',
        resultado:          null,
        creado_por:         user.id,
      })

      if (insertError && insertError.code === '23505') {
        // Ya existe → actualizar solo metadatos, NUNCA estado ni resultado
        const { error: updateError } = await supabase.from('licitaciones')
          .update(metadatos)
          .eq('org_id', perfil.org_id)
          .eq('codigo_chilecompra', item.codigo)
        const error = updateError
        if (error) errores.push(`${item.codigo}: ${error.message}`)
        else importados++
      } else {
        if (insertError) errores.push(`${item.codigo}: ${insertError.message}`)
        else importados++
      }
    }

    return NextResponse.json({ importados, errores })
  } catch (err) {
    console.error('[sync] POST error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
