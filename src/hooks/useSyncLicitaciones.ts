'use client'

import { useEffect } from 'react'
import { type LicitacionConAlerta } from '@/types'
import { useLicitacionesStore } from '@/components/ui/CommandPaletteProvider'

// Sincroniza las licitaciones cargadas por la página al store global
// para que el CommandPalette pueda buscarlas sin suscripción duplicada.
export function useSyncLicitaciones(licitaciones: LicitacionConAlerta[]) {
  const { setLicitaciones } = useLicitacionesStore()
  useEffect(() => {
    setLicitaciones(licitaciones)
  }, [licitaciones, setLicitaciones])
}
