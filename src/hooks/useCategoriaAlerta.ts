'use client'

import { useMemo } from 'react'
import { type Licitacion, type CategoriaAlerta, ALERTAS } from '@/types'
import { calcularCategoriaAlerta, formatearTiempoRestante, horasRestantes } from '@/lib/utils/categoria-alerta'

export function useCategoriaAlerta(licitacion: Pick<Licitacion, 'estado' | 'resultado' | 'fecha_cierre_1'>) {
  return useMemo(() => {
    const ahora = new Date()
    const categoria: CategoriaAlerta = calcularCategoriaAlerta(licitacion, ahora)
    const horas = horasRestantes(licitacion.fecha_cierre_1, ahora)
    const config = ALERTAS[categoria]
    return {
      categoria,
      horas,
      tiempoRestante: formatearTiempoRestante(horas),
      label: config.label,
      color: config.color,
      textColor: config.textColor,
      borderColor: config.borderColor,
    }
  }, [licitacion])
}
