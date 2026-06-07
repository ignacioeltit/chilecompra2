'use client'

import { createContext, useContext, useState } from 'react'
import { type LicitacionConAlerta } from '@/types'

interface LicitacionesStore {
  licitaciones: LicitacionConAlerta[]
  setLicitaciones: (lics: LicitacionConAlerta[]) => void
}

export const LicitacionesCtx = createContext<LicitacionesStore>({
  licitaciones: [],
  setLicitaciones: () => {},
})

export function LicitacionesProvider({ children }: { children: React.ReactNode }) {
  const [licitaciones, setLicitaciones] = useState<LicitacionConAlerta[]>([])
  return (
    <LicitacionesCtx.Provider value={{ licitaciones, setLicitaciones }}>
      {children}
    </LicitacionesCtx.Provider>
  )
}

export function useLicitacionesStore() {
  return useContext(LicitacionesCtx)
}
