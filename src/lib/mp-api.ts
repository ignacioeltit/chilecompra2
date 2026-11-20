import { fromZonedTime } from 'date-fns-tz'

const TZ = 'America/Santiago'

export const MP_AUTH_URL   = 'https://servicios-prd.mercadopublico.cl/v1/auth/publico'
export const MP_SEARCH_URL = 'https://api.buscador.mercadopublico.cl/compra-agil'
export const MP_API_URL    = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json'
export const MP_OC_URL     = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json'

export interface ItemSync {
  codigo: string
  nombre: string
  descripcion: string | null
  fecha_publicacion: string | null
  fecha_cierre: string | null
  organismo: string
  monto: number | null
  tipo: 'COT' | 'LE' | 'LP' | 'LR' | 'L1' | 'LC'
  region?: string
}

export function parseFechaMP(s: string | null | undefined): string | null {
  if (!s) return null

  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (m1) return fromZonedTime(`${m1[1]}-${m1[2]}-${m1[3]}T${m1[4]}:${m1[5]}:00`, TZ).toISOString()

  const m2 = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  if (m2) return fromZonedTime(m2[1], TZ).toISOString()

  const m3 = s.match(/^(\d{1,2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m3) {
    const local = `${m3[3]}-${m3[2]}-${m3[1].padStart(2, '0')}T${m3[4].padStart(2, '0')}:${m3[5]}:${m3[6] ?? '00'}`
    return fromZonedTime(local, TZ).toISOString()
  }

  return null
}

export function parseFechaISO(s: string | null | undefined): Date | null {
  const iso = parseFechaMP(s)
  return iso ? new Date(iso) : null
}

export function tipoDesdeCodigoExterno(codigo: string): ItemSync['tipo'] {
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

export async function fetchCOT(
  dateFrom: string,
  dateTo: string,
  regiones: string[],
  apiKey: string,
): Promise<ItemSync[]> {
  const tokenRes = await fetch(MP_AUTH_URL, {
    headers: { 'Accept': 'application/json', 'Origin': 'https://buscador.mercadopublico.cl' },
    next: { revalidate: 0 },
  })
  const token = (await tokenRes.json()).payload.access_token

  const fetchRegion = async (region: string): Promise<ItemSync[]> => {
    const params = new URLSearchParams({
      date_from: dateFrom, date_to: dateTo,
      order_by: 'recent', region, page_number: '1',
    })

    const fetchPag = async (page: number) => {
      params.set('page_number', String(page))
      const res = await fetch(`${MP_SEARCH_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': apiKey,
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

export async function fetchLicitaciones(ticket: string, regiones: string[]): Promise<ItemSync[]> {
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
