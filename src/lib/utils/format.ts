export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  })
}

export function urlMercadoPublico(codigo: string): string {
  if (/COT/i.test(codigo)) {
    // Compras ágiles: requiere login como proveedor
    return `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${encodeURIComponent(codigo)}`
  }
  // Licitaciones LE/LP/L1/LR: ficha pública sin login
  return `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(codigo)}`
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  })
}
