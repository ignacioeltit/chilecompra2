import { describe, it, expect } from 'vitest'
import { parseCLP, formatCLP } from '../src/lib/clp'

describe('parseCLP', () => {
  it('parsea monto con puntos de miles', () => {
    expect(parseCLP('660.475')).toBe(660475)
  })

  it('parsea monto con símbolo $ y puntos', () => {
    expect(parseCLP('$1.095.815')).toBe(1095815)
  })

  it('parsea monto sin puntos', () => {
    expect(parseCLP('660475')).toBe(660475)
  })

  it('parsea número entero directamente', () => {
    expect(parseCLP(660475)).toBe(660475)
  })

  it('rechaza decimales con coma (CLP no tiene centavos)', () => {
    expect(parseCLP('660,5')).toBeNull()
  })

  it('retorna null para string vacío', () => {
    expect(parseCLP('')).toBeNull()
  })

  it('retorna null para null', () => {
    expect(parseCLP(null)).toBeNull()
  })

  it('retorna null para undefined', () => {
    expect(parseCLP(undefined)).toBeNull()
  })

  it('retorna null para número con decimales', () => {
    expect(parseCLP(660.5)).toBeNull()
  })

  it('retorna null para cero o negativo', () => {
    expect(parseCLP(0)).toBeNull()
    expect(parseCLP(-1000)).toBeNull()
  })

  it('parsea monto grande', () => {
    expect(parseCLP('4.674.271')).toBe(4674271)
  })

  it('parsea monto con espacios', () => {
    expect(parseCLP('  1.500.000  ')).toBe(1500000)
  })
})

describe('formatCLP', () => {
  it('formatea correctamente', () => {
    expect(formatCLP(660475)).toMatch(/660/)
    expect(formatCLP(660475)).toMatch(/\$/)
  })

  it('retorna — para null', () => {
    expect(formatCLP(null)).toBe('—')
  })
})
