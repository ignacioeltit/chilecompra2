import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { mkdir, appendFile } from 'fs/promises'
import path from 'path'

const ESTADO_MAP: Record<string, string> = {
  'ENVIADO':          'enviada',
  'ENVIADA':          'enviada',
  'ENVIADOS':         'enviada',
  'PENDIENTE':        'pendiente_enviar',
  'PENDIENTE ENVIAR': 'pendiente_enviar',
  'REVISAR':          'revisar',
  'NO PARTICIPE':     'no_participe',
  'NO PARTICIPÉ':     'no_participe',
  'CANCELADA':        'cancelada',
  'CANCELADO':        'cancelada',
  'SIN DEFINIR':      'sin_definir',
  'REVISADO':         'revisado',
  'REVISADA':         'revisado',
}

const RESULTADO_MAP: Record<string, string> = {
  'GANADA':          'ganada',
  'GANADO':          'ganada',
  'PERDIDA':         'perdida',
  'PERDIDO':         'perdida',
  'DESIERTA':        'desierta',
  'DESIERTO':        'desierta',
  'CERRADA SIN ADJ': 'cerrada_sin_adj',
  'CERRADA':         'cerrada_sin_adj',
}

async function writeLogFile(logPath: string, entry: unknown) {
  try {
    await mkdir(path.dirname(logPath), { recursive: true })
    await appendFile(logPath, JSON.stringify(entry) + '\n')
  } catch (e) {
    console.error('[import] No se pudo escribir log en archivo', e)
  }
}

function parsearFecha(valor: unknown): string | null {
  if (!valor) return null
  // Si Excel ya entregó un objeto Date
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString()
  }

  const s = String(valor).trim()

  // Patron: 08-06-2026, 05:50 p. m.  o 08-06-2026 05:50 PM  o 08/06/2026 05:50
  const regex1 = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})[,\s]*\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm|AM|PM)?\.?$/i
  const m1 = s.match(regex1)
  if (m1) {
    let [, d, m, y, h, min, sec, ampm] = m1 as string[]
    d = d.padStart(2, '0')
    m = m.padStart(2, '0')
    sec = sec || '00'
    // Normalizar hora según am/pm si aplica
    let hourNum = Number(h)
    if (ampm) {
      const am = /^(a\.m\.|am)$/i.test(ampm)
      const pm = /^(p\.m\.|pm)$/i.test(ampm)
      if (pm && hourNum < 12) hourNum += 12
      if (am && hourNum === 12) hourNum = 0
    }
    const HH = String(hourNum).padStart(2, '0')
    return `${y}-${m}-${d}T${HH}:${min}:${sec}-03:00`
  }

  // Patron con texto 'a las' como '08-06-2026 a las 05:50:00'
  const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+a las\s+(\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    const [, d, m, y, h, min, sec] = match
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${h}:${min}:${sec}-03:00`
  }

  // Intentar parsear como fecha ISO u otros formatos comprendidos por Date
  const fecha = new Date(s)
  if (!isNaN(fecha.getTime())) return fecha.toISOString()
  return null
}

function normalizar(valor: unknown, mapa: Record<string, string>): string | null {
  if (!valor) return null
  const clave = String(valor).trim().toUpperCase()
  return mapa[clave] ?? null
}

function celda(row: ExcelJS.Row, col: number | string): unknown {
  const cell = row.getCell(col)
  if (cell.type === ExcelJS.ValueType.Formula) return cell.result
  return cell.value
}

export async function POST(req: NextRequest) {
  // Preparar ruta de log única para esta invocación
  const logPath = path.join(process.cwd(), 'logs', `import-${Date.now()}.log`)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const startEntry = { event: 'start', user: user.id, ts: new Date().toISOString() }
    console.log('[import]', startEntry)
    await writeLogFile(logPath, startEntry)

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('org_id, rol')
      .eq('id', user.id)
      .single()

    console.log('[import] Perfil obtenido:', perfil)
    await writeLogFile(logPath, { event: 'perfil', perfil })

    if (!perfil || perfil.rol !== 'admin')
      return NextResponse.json({ error: 'Solo administradores pueden importar' }, { status: 403 })

    const formData = await req.formData()
    const archivo = formData.get('file') as File | null
    if (!archivo) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

    // Protección: rechazar archivos demasiado grandes para evitar problemas en entorno serverless
    const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
    if (archivo.size > MAX_SIZE) {
      console.error('[import] Archivo demasiado grande:', archivo.name, archivo.size)
      await writeLogFile(logPath, { event: 'file_too_large', name: archivo.name, size: archivo.size })
      return NextResponse.json({ error: 'Archivo demasiado grande. Límite 20MB.' }, { status: 413 })
    }

    console.log('[import] Archivo recibido:', archivo.name, 'size:', archivo.size)
    await writeLogFile(logPath, { event: 'file', name: archivo.name, size: archivo.size })

    const arrayBuf = await archivo.arrayBuffer()
    // TypeScript 5.8 hace Buffer genérico; exceljs espera el no-genérico
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = Buffer.from(new Uint8Array(arrayBuf)) as any

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'Archivo sin hojas' }, { status: 400 })

    // Obtener cabeceras de la primera fila
    const headerRow = ws.getRow(1)
    const headers: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim()
      if (val) headers[val] = colNumber
    })

    console.log('[import] Headers detectadas:', headers)
    await writeLogFile(logPath, { event: 'headers', headers })

    const colIdx = (nombres: string[]): number | null => {
      for (const n of nombres) {
        if (headers[n]) return headers[n]
      }
      return null
    }

    const COL_ID       = colIdx(['ID', 'Código', 'codigo'])
    const COL_NOMBRE   = colIdx(['Nombre', 'nombre'])
    const COL_CIERRE1  = colIdx(['Fecha de cierre 1ER LLAMADO', 'Fecha Cierre 1', 'Fecha cierre 1'])
    const COL_INST     = colIdx(['Institución', 'Institucion', 'institucion'])
    const COL_ESTADO   = colIdx(['Estado', 'estado'])
    const COL_RESULT   = colIdx(['RESULTADO', 'Resultado', 'resultado'])
    const COL_OC       = colIdx(['Orden de compra', 'Orden de Compra', 'orden_compra'])
    const COL_MONTO    = colIdx(['Monto', 'monto', 'Monto CLP'])
    const COL_CIERRE2  = colIdx(['Fecha de cierre 2DO LLAMADO', 'Fecha Cierre 2'])
    const COL_PUBLI    = colIdx(['Fecha de publicación', 'Fecha Publicacion'])

    // Hacer más verboso para depuración
    const resultados = { importados: 0, errores: 0, detalles: [] as (string | Record<string, unknown>)[] }

    for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
      const row = ws.getRow(rowNum)

      // Fila vacía → saltar
      if (!row.hasValues) continue

      try {
        const codigoRaw = COL_ID ? String(celda(row, COL_ID) ?? '').trim() : ''
        const nombreRaw = COL_NOMBRE ? String(celda(row, COL_NOMBRE) ?? '').trim() : ''
        const cierre1Raw = COL_CIERRE1 ? parsearFecha(celda(row, COL_CIERRE1)) : null
        const institucionRaw = COL_INST ? String(celda(row, COL_INST) ?? '').trim() : ''

        // Log raw values
        console.log('[import] Fila', rowNum, 'raw:', { codigoRaw, nombreRaw, cierre1Raw, institucionRaw })
        await writeLogFile(logPath, { event: 'row_raw', row: rowNum, codigoRaw, nombreRaw, cierre1Raw, institucionRaw })

        // Rellenos por defecto para evitar errores por datos requeridos faltantes
        const codigo = codigoRaw || `IMPORT-${Date.now()}-${rowNum}`
        const nombre = nombreRaw || `Sin nombre (fila ${rowNum})`
        const cierre1 = cierre1Raw ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const institucion = institucionRaw || 'Sin institución'

        const estado   = normalizar(COL_ESTADO ? celda(row, COL_ESTADO) : null, ESTADO_MAP) ?? 'sin_definir'
        const resultado = normalizar(COL_RESULT ? celda(row, COL_RESULT) : null, RESULTADO_MAP)
        const oc        = COL_OC ? String(celda(row, COL_OC) ?? '').trim() || null : null
        const monto     = COL_MONTO ? (Number(celda(row, COL_MONTO)) || null) : null
        const cierre2   = COL_CIERRE2 ? parsearFecha(celda(row, COL_CIERRE2)) : null
        const publi     = COL_PUBLI  ? parsearFecha(celda(row, COL_PUBLI)) : null

        // Buscar/crear institución con upsert idempotente
        let instId: string | null = null
        const { data: inst, error: instError } = await supabase
          .from('instituciones')
          .upsert({ org_id: perfil.org_id, nombre: institucion }, { onConflict: 'org_id,nombre' })
          .select('id')
          .maybeSingle()

        if (instError) {
          console.log('[import] Error upsert institución en fila', rowNum, instError.message)
          await writeLogFile(logPath, { event: 'inst_error', row: rowNum, error: instError.message })
          resultados.detalles.push({ row: rowNum, issue: 'inst_error', error: instError.message })
        }
        instId = inst?.id ?? null

        const valuesForInsert = {
          org_id: perfil.org_id,
          codigo_chilecompra: codigo,
          nombre,
          fecha_cierre_1:    cierre1,
          fecha_cierre_2:    cierre2,
          fecha_publicacion: publi,
          estado,
          resultado,
          institucion_id: instId,
          institucion,
          orden_compra:   oc,
          monto_clp:      monto,
          creado_por:     user.id,
        }

        console.log('[import] Valores preparados para fila', rowNum, valuesForInsert)
        await writeLogFile(logPath, { event: 'row_prepared', row: rowNum, values: valuesForInsert })

        const { error } = await supabase.from('licitaciones').upsert(valuesForInsert, { onConflict: 'org_id,codigo_chilecompra' })

        if (error) {
          console.log('[import] Error upsert fila', rowNum, error.message)
          await writeLogFile(logPath, { event: 'upsert_error', row: rowNum, error: error.message, values: valuesForInsert })
          resultados.errores++
          resultados.detalles.push({ row: rowNum, codigo, error: error.message, values: valuesForInsert })
        } else {
          console.log('[import] Upsert OK fila', rowNum, codigo)
          await writeLogFile(logPath, { event: 'upsert_ok', row: rowNum, codigo })
          resultados.importados++
          resultados.detalles.push({ row: rowNum, codigo, values: valuesForInsert })
        }
      } catch (e) {
        console.log('[import] Excepción fila', rowNum, e)
        await writeLogFile(logPath, { event: 'row_exception', row: rowNum, error: String(e) })
        resultados.errores++
        resultados.detalles.push({ row: rowNum, error: String(e) })
      }
    }

    // Después del import, obtener últimos 10 registros para este org para ayudar diagnóstico
    let recientes: unknown[] = []
    try {
      const { data: last } = await supabase
        .from('licitaciones')
        .select('id, codigo_chilecompra, nombre, fecha_cierre_1, institucion')
        .eq('org_id', perfil.org_id)
        .order('creado_en', { ascending: false })
        .limit(10)
      recientes = last ?? []
    } catch (e) {
      console.log('[import] Error obteniendo recientes', e)
      await writeLogFile(logPath, { event: 'recientes_error', error: String(e) })
    }

    console.log('[import] Resultados finales', resultados)
    await writeLogFile(logPath, { event: 'end', resultados })

    return NextResponse.json({ resultados, recientes })
  } catch (err) {
    console.error('[import] Error inesperado en handler POST', err)
    await writeLogFile(path.join(process.cwd(), 'logs', `import-error-${Date.now()}.log`), { event: 'fatal', error: String(err) })
    // Devolver JSON 500 con mensaje para evitar 'Failed to fetch' sin respuesta
    return NextResponse.json({ error: 'Error interno en import. Ver logs del servidor.' }, { status: 500 })
  }
}
