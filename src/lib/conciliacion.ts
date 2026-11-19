/**
 * Algoritmo de conciliación cartola ↔ facturas.
 * Puro (sin I/O), 100% testeable en vitest.
 */

export interface FacturaCandidato {
  id: string
  monto: number          // numeric entero CLP
  fechaEmision: string   // ISO date YYYY-MM-DD
  rutReceptor: string | null
  razonSocialReceptor: string | null
  pagoFecha: string | null  // ya pagada si no es null
}

export interface MovimientoBancario {
  id: string
  fecha: string          // ISO date YYYY-MM-DD
  descripcion: string
  abono: number | null
  cargo: number | null
}

export type TipoConciliacion = 'directo' | 'agrupado' | 'factoring' | 'manual'
export type Confianza = 'exacta' | 'probable'

export interface Calce {
  movimientoId: string
  facturaIds: string[]       // 1..N facturas
  montoAplicado: number      // suma de las facturas involucradas
  tipo: TipoConciliacion
  confianza: Confianza
  costoFactoring?: number    // solo para tipo 'factoring'
}

// Descripciones que se ignoran en la conciliación automática
const DESC_EXCLUIR_DEFAULT = [
  'tef de ',
  'deposito en efectivo',
  'depósito en efectivo',
  'prov haulmer',
  'traspaso',
  'cargo comision',
  'cargo comisión',
  'iva debito',
  'iva débito',
]

function daysFrom(isoFrom: string, isoTo: string): number {
  return Math.floor(
    (new Date(isoTo).getTime() - new Date(isoFrom).getTime()) / 86400000
  )
}

function descContiene(desc: string, terminos: string[]): boolean {
  const d = desc.toLowerCase()
  return terminos.some(t => d.includes(t.toLowerCase()))
}

function esFactoring(desc: string): boolean {
  return desc.toLowerCase().includes('factoring')
}

/** Facturas que están impagas y emitidas antes del abono */
function candidatasImpagas(
  facturas: FacturaCandidato[],
  fechaAbono: string,
): FacturaCandidato[] {
  return facturas.filter(
    f => f.pagoFecha === null && f.fechaEmision <= fechaAbono
  )
}

/**
 * Busca todas las combinaciones de `k` elementos de `arr`
 * cuya suma sea `objetivo`. Límite: combinaciones de 2..4.
 */
function combinacionesSuma(
  arr: FacturaCandidato[],
  objetivo: number,
  k: number,
): FacturaCandidato[][] {
  const resultado: FacturaCandidato[][] = []

  function bt(inicio: number, actual: FacturaCandidato[], suma: number) {
    if (actual.length === k) {
      if (suma === objetivo) resultado.push([...actual])
      return
    }
    for (let i = inicio; i < arr.length; i++) {
      const nueva = suma + arr[i].monto
      if (nueva > objetivo) continue  // arr podría no estar ordenado; no prunear hard
      bt(i + 1, [...actual, arr[i]], nueva)
    }
  }

  bt(0, [], 0)
  return resultado
}

export function conciliar(
  movimientos: MovimientoBancario[],
  facturas: FacturaCandidato[],
  descExcluir: string[] = DESC_EXCLUIR_DEFAULT,
): Calce[] {
  const calces: Calce[] = []
  // facturas ya usadas en un calce (para no reutilizar)
  const facturasUsadas = new Set<string>()

  const abonos = movimientos.filter(
    m => m.abono !== null && m.abono > 0 && !descContiene(m.descripcion, descExcluir)
  )

  for (const mov of abonos) {
    const monto = mov.abono!

    // ── Factoring ──────────────────────────────────────────
    if (esFactoring(mov.descripcion)) {
      const candidatas = candidatasImpagas(facturas, mov.fecha).filter(
        f => !facturasUsadas.has(f.id)
      )
      // buscar factura donde abono/monto entre 0.85 y 0.995 y emitida en los 20 días previos
      const candidataFactoring = candidatas.find(f => {
        const ratio = monto / f.monto
        const dias = daysFrom(f.fechaEmision, mov.fecha)
        return ratio >= 0.85 && ratio <= 0.995 && dias >= 0 && dias <= 20
      })
      if (candidataFactoring) {
        facturasUsadas.add(candidataFactoring.id)
        calces.push({
          movimientoId: mov.id,
          facturaIds: [candidataFactoring.id],
          montoAplicado: candidataFactoring.monto,
          tipo: 'factoring',
          confianza: 'probable',
          costoFactoring: candidataFactoring.monto - monto,
        })
        continue
      }
    }

    const candidatas = candidatasImpagas(facturas, mov.fecha).filter(
      f => !facturasUsadas.has(f.id)
    )

    // ── Directo ────────────────────────────────────────────
    const exactas = candidatas.filter(f => f.monto === monto)
    if (exactas.length === 1) {
      facturasUsadas.add(exactas[0].id)
      calces.push({
        movimientoId: mov.id,
        facturaIds: [exactas[0].id],
        montoAplicado: monto,
        tipo: 'directo',
        confianza: 'exacta',
      })
      continue
    }
    if (exactas.length > 1) {
      // Varias facturas con el mismo monto → elegir la emitida más cerca antes del abono
      const ordenadas = [...exactas].sort((a, b) =>
        daysFrom(a.fechaEmision, mov.fecha) - daysFrom(b.fechaEmision, mov.fecha)
      )
      facturasUsadas.add(ordenadas[0].id)
      calces.push({
        movimientoId: mov.id,
        facturaIds: [ordenadas[0].id],
        montoAplicado: monto,
        tipo: 'directo',
        confianza: 'probable',
      })
      continue
    }

    // ── Agrupado (2..4 facturas del mismo receptor) ────────
    // Intentar primero con el receptor más frecuente en la descripción
    let encontradoAgrupado = false
    for (let k = 2; k <= 4 && !encontradoAgrupado; k++) {
      const combis = combinacionesSuma(candidatas, monto, k)
      if (combis.length === 1) {
        combis[0].forEach(f => facturasUsadas.add(f.id))
        calces.push({
          movimientoId: mov.id,
          facturaIds: combis[0].map(f => f.id),
          montoAplicado: monto,
          tipo: 'agrupado',
          confianza: 'exacta',
        })
        encontradoAgrupado = true
      } else if (combis.length > 1) {
        // Ambigüedad: tomar primera, marcar probable
        combis[0].forEach(f => facturasUsadas.add(f.id))
        calces.push({
          movimientoId: mov.id,
          facturaIds: combis[0].map(f => f.id),
          montoAplicado: monto,
          tipo: 'agrupado',
          confianza: 'probable',
        })
        encontradoAgrupado = true
      }
    }
  }

  return calces
}
