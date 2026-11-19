/**
 * Parsea un monto en pesos chilenos (CLP, entero sin decimales).
 * El punto es separador de miles en Chile, no decimal.
 *
 * Ejemplos:
 *   parseCLP("660.475")   → 660475
 *   parseCLP("$1.095.815") → 1095815
 *   parseCLP("660475")    → 660475
 *   parseCLP("660,5")     → null  (CLP no tiene centavos)
 *   parseCLP(660475)      → 660475
 */
export function parseCLP(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input <= 0) return null
    return input
  }
  const cleaned = input
    .replace(/[$\s.]/g, '')  // $ símbolo, espacios y puntos de miles
    .trim()

  // Si queda una coma, hay decimales → CLP no los acepta
  if (cleaned.includes(',')) return null

  const n = parseInt(cleaned, 10)
  if (isNaN(n) || n <= 0) return null
  return n
}

/**
 * Formatea un entero como moneda CLP.
 * Ejemplo: 660475 → "$660.475"
 */
export function formatCLP(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}
