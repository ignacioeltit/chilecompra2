import * as XLSX from 'xlsx'
import { parseCLP } from '@/lib/clp'

export interface FilaCartola {
  fecha: string        // ISO date YYYY-MM-DD
  sucursal: string
  nOperacion: string
  descripcion: string
  cargo: number | null
  abono: number | null
  saldo: number | null
}

export interface CartolaMeta {
  nCartola: number | null
  periodoDesde: string | null  // ISO date
  periodoHasta: string | null  // ISO date
  filas: FilaCartola[]
}

/** Convierte "DD/MM" + año a "YYYY-MM-DD" */
function parseFechaBE(raw: string, year: number): string | null {
  const m = String(raw ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Extrae el año de un string de fecha "DD/MM/YYYY" o "YYYY-MM-DD" */
function extractYear(raw: string): number | null {
  const m4 = String(raw ?? '').match(/(\d{4})/)
  return m4 ? parseInt(m4[1]) : null
}

export function parseCartolaBancoEstado(buffer: ArrayBuffer): CartolaMeta {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })

  let nCartola: number | null = null
  let periodoDesde: string | null = null
  let periodoHasta: string | null = null
  let year = new Date().getFullYear()

  // Buscar cabecera con metadata (primeras 10 filas)
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map(c => String(c ?? '').trim())
    const line = row.join(' ')

    // "N° Cartola: 123" o "Cartola N° 123"
    const mCartola = line.match(/cartola[:\s#°Nn]+(\d+)/i)
    if (mCartola) nCartola = parseInt(mCartola[1])

    // "Fecha Inicio: 01/05/2026" o "Desde: 01/05/2026"
    const mDesde = line.match(/(?:inicio|desde)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (mDesde) {
      const y = extractYear(mDesde[1])
      if (y) year = y
      const parts = mDesde[1].split('/')
      periodoDesde = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    }

    // "Fecha Final: 19/11/2026" o "Hasta: 19/11/2026"
    const mHasta = line.match(/(?:final|hasta|término|termino)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (mHasta) {
      const parts = mHasta[1].split('/')
      periodoHasta = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    }
  }

  // Encontrar fila de cabecera de datos
  // Buscar la fila que contenga "Fecha" y "Descripción" (o "Descripcion")
  let headerIdx = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i].map(c => String(c ?? '').toLowerCase())
    if (row.some(c => c.includes('fecha')) && row.some(c => c.includes('descripci'))) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) throw new Error('No se encontró la cabecera de la cartola (Fecha | Descripción)')

  const headers = rows[headerIdx].map(c => String(c ?? '').toLowerCase().trim())

  const colFecha    = headers.findIndex(h => h.includes('fecha'))
  const colSucursal = headers.findIndex(h => h.includes('sucursal'))
  const colNOp      = headers.findIndex(h => h.includes('operaci'))
  const colDesc     = headers.findIndex(h => h.includes('descripci'))
  const colCargo    = headers.findIndex(h => h.includes('cargo') || h.includes('cheque'))
  const colAbono    = headers.findIndex(h => h.includes('abono') || h.includes('dep'))
  const colSaldo    = headers.findIndex(h => h.includes('saldo'))

  if (colFecha === -1 || colDesc === -1)
    throw new Error('Columnas esperadas no encontradas en la cartola')

  const filas: FilaCartola[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const fechaRaw = String(row[colFecha] ?? '').trim()
    if (!fechaRaw || fechaRaw === '') continue

    const fecha = parseFechaBE(fechaRaw, year)
    if (!fecha) continue

    const cargo = colCargo >= 0 ? parseCLP(String(row[colCargo] ?? '')) : null
    const abono = colAbono >= 0 ? parseCLP(String(row[colAbono] ?? '')) : null
    const saldo = colSaldo >= 0 ? parseCLP(String(row[colSaldo] ?? '')) : null

    filas.push({
      fecha,
      sucursal: colSucursal >= 0 ? String(row[colSucursal] ?? '').trim() : '',
      nOperacion: colNOp >= 0 ? String(row[colNOp] ?? '').trim() : '',
      descripcion: String(row[colDesc] ?? '').trim(),
      cargo,
      abono,
      saldo,
    })
  }

  return { nCartola, periodoDesde, periodoHasta, filas }
}
