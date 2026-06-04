import { type Licitacion, type CategoriaAlerta } from '@/types'

/**
 * Calcula la categoría de alerta para una licitación en el cliente.
 * Misma lógica que la vista v_licitaciones_con_alerta en Postgres.
 */
export function calcularCategoriaAlerta(
  licitacion: Pick<Licitacion, 'estado' | 'resultado' | 'fecha_cierre_1'>,
  ahora: Date = new Date()
): CategoriaAlerta {
  const { estado, resultado, fecha_cierre_1 } = licitacion
  const cierre = new Date(fecha_cierre_1)
  const horasRestantes = (cierre.getTime() - ahora.getTime()) / (1000 * 60 * 60)

  // 1. Revisado (solo para seguimiento de intel — no requiere acción)
  if (estado === 'revisado') return 'revisado'

  // 2. Resultado registrado o estado final
  if (
    resultado !== null ||
    estado === 'cancelada' ||
    estado === 'no_participe'
  ) return 'resultado_registrado'

  // 2. Enviada, ya cerró, sin resultado
  if (estado === 'enviada' && cierre < ahora && resultado === null)
    return 'revisar_resultado'

  // 3. Revisión pendiente
  if (estado === 'revisar') return 'pendiente_revision'

  // 5. Pendiente de envío
  if (estado === 'pendiente_enviar') return 'pendiente_enviar'

  // 6. Enviada, aún no cierra
  if (estado === 'enviada' && cierre >= ahora) return 'cotizada'

  // 7. Cerró sin cotizar
  if (cierre < ahora && !['enviada', 'cancelada', 'no_participe'].includes(estado))
    return 'cerrada_sin_cotizar'

  // 8. Urgente ≤24h
  if (horasRestantes <= 24) return 'urgente'

  // 9. Pronto ≤72h
  if (horasRestantes <= 72) return 'pronto'

  // 10. Sin definir
  if (estado === 'sin_definir') return 'sin_definir'

  return 'ok'
}

export function horasRestantes(fechaCierre: string, ahora: Date = new Date()): number {
  const cierre = new Date(fechaCierre)
  return (cierre.getTime() - ahora.getTime()) / (1000 * 60 * 60)
}

export function formatearTiempoRestante(horas: number): string {
  if (horas < 0) return 'Cerrada'
  if (horas < 1) {
    const minutos = Math.floor(horas * 60)
    return `${minutos}m`
  }
  if (horas < 24) return `${Math.floor(horas)}h`
  const dias = Math.floor(horas / 24)
  const restoHoras = Math.floor(horas % 24)
  return restoHoras > 0 ? `${dias}d ${restoHoras}h` : `${dias}d`
}
