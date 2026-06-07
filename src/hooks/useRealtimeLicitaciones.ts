'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type LicitacionConAlerta } from '@/types'

// Singleton — un solo cliente por tab; evita el loop de fetches causado
// por createClient() en el cuerpo del hook (nueva referencia en cada render).
const supabase = createClient()

export function useRealtimeLicitaciones(orgId: string) {
  const [licitaciones, setLicitaciones] = useState<LicitacionConAlerta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!orgId) {
      setLicitaciones([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)

    // Una sola query a la vista: ya incluye todos los campos de licitaciones
    // (l.*) más horas_restantes y categoria_alerta_calc calculados en Postgres.
    const { data, error: err } = await supabase
      .from('v_licitaciones_con_alerta')
      .select('*')
      .eq('org_id', orgId)
      .order('fecha_cierre_1', { ascending: true })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setLicitaciones((data as LicitacionConAlerta[]) ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    // Si otra página marcó que hay cambios pendientes (ej: detalle actualizó estado),
    // siempre recargar aunque el componente se haya restaurado desde router cache.
    void cargar()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dashboard_stale')
    }

    if (!orgId) return

    // Suscripción realtime: cualquier cambio en la tabla licitaciones de esta
    // org dispara una recarga de la vista con los valores actualizados.
    const channel = supabase
      .channel(`licitaciones_org_${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licitaciones', filter: `org_id=eq.${orgId}` },
        () => { void cargar() },
      )
      .subscribe()

    // Recargar cuando el usuario vuelve a la pestaña (visibilitychange)
    // o cuando el browser restaura la página desde bfcache / router cache
    // de Next.js (pageshow). Sin esto, navegar de vuelta al dashboard
    // puede mostrar datos obsoletos porque el componente no remonta.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void cargar()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      // persisted=true → página restaurada desde caché (bfcache / router cache)
      // persisted=false → carga normal (useEffect ya llamó cargar() al montar)
      if (e.persisted) void cargar()
    }
    // Señal desde otras páginas (ej: detalle guardó un cambio)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dashboard_stale') void cargar()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)

    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
    }
  }, [orgId, cargar])

  return { licitaciones, loading, error, recargar: () => { if (orgId) void cargar() } }
}
