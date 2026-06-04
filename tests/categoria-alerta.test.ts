import { describe, it, expect } from 'vitest'
import { calcularCategoriaAlerta } from '../src/lib/utils/categoria-alerta'
import type { Licitacion } from '../src/types'

type Lic = Pick<Licitacion, 'estado' | 'resultado' | 'fecha_cierre_1'>

const HACE_1H  = new Date(Date.now() - 1  * 3600_000).toISOString()
const HACE_5D  = new Date(Date.now() - 5  * 24 * 3600_000).toISOString()
const EN_12H   = new Date(Date.now() + 12 * 3600_000).toISOString()
const EN_48H   = new Date(Date.now() + 48 * 3600_000).toISOString()
const EN_5D    = new Date(Date.now() + 5  * 24 * 3600_000).toISOString()
const EN_10D   = new Date(Date.now() + 10 * 24 * 3600_000).toISOString()

describe('calcularCategoriaAlerta', () => {
  it('resultado registrado cuando hay resultado', () => {
    const lic: Lic = { estado: 'enviada', resultado: 'ganada', fecha_cierre_1: HACE_1H }
    expect(calcularCategoriaAlerta(lic)).toBe('resultado_registrado')
  })

  it('resultado registrado cuando estado es cancelada', () => {
    const lic: Lic = { estado: 'cancelada', resultado: null, fecha_cierre_1: EN_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('resultado_registrado')
  })

  it('resultado registrado cuando estado es no_participe', () => {
    const lic: Lic = { estado: 'no_participe', resultado: null, fecha_cierre_1: EN_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('resultado_registrado')
  })

  it('revisar_resultado cuando enviada y ya cerró sin resultado', () => {
    const lic: Lic = { estado: 'enviada', resultado: null, fecha_cierre_1: HACE_1H }
    expect(calcularCategoriaAlerta(lic)).toBe('revisar_resultado')
  })

  it('pendiente_revision cuando estado es revisar', () => {
    const lic: Lic = { estado: 'revisar', resultado: null, fecha_cierre_1: EN_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('pendiente_revision')
  })

  it('pendiente_enviar cuando estado es pendiente_enviar', () => {
    const lic: Lic = { estado: 'pendiente_enviar', resultado: null, fecha_cierre_1: EN_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('pendiente_enviar')
  })

  it('cotizada cuando enviada y aún no cierra', () => {
    const lic: Lic = { estado: 'enviada', resultado: null, fecha_cierre_1: EN_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('cotizada')
  })

  it('cerrada_sin_cotizar cuando cerró sin enviar', () => {
    const lic: Lic = { estado: 'sin_definir', resultado: null, fecha_cierre_1: HACE_5D }
    expect(calcularCategoriaAlerta(lic)).toBe('cerrada_sin_cotizar')
  })

  it('urgente cuando faltan menos de 24h', () => {
    const lic: Lic = { estado: 'sin_definir', resultado: null, fecha_cierre_1: EN_12H }
    expect(calcularCategoriaAlerta(lic)).toBe('urgente')
  })

  it('pronto cuando faltan entre 24h y 72h', () => {
    const lic: Lic = { estado: 'sin_definir', resultado: null, fecha_cierre_1: EN_48H }
    expect(calcularCategoriaAlerta(lic)).toBe('pronto')
  })

  it('sin_definir cuando estado es sin_definir y aún no cierra (>72h)', () => {
    const lic: Lic = { estado: 'sin_definir', resultado: null, fecha_cierre_1: EN_10D }
    expect(calcularCategoriaAlerta(lic)).toBe('sin_definir')
  })

  it('ok como default cuando estado ok y cierre lejano', () => {
    const lic: Lic = { estado: 'pendiente_enviar', resultado: null, fecha_cierre_1: EN_10D }
    // pendiente_enviar tiene prioridad sobre ok
    expect(calcularCategoriaAlerta(lic)).toBe('pendiente_enviar')
  })

  it('la prioridad es correcta: resultado > revisar_resultado', () => {
    // Si tiene resultado, no importa que haya cerrado
    const lic: Lic = { estado: 'enviada', resultado: 'perdida', fecha_cierre_1: HACE_1H }
    expect(calcularCategoriaAlerta(lic)).toBe('resultado_registrado')
  })
})
