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
    void cargar()

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

    // Recargar cuando el usuario vuelve a la pestaña o navega de vuelta.
    // Next.js App Router puede restaurar páginas desde caché sin remontar el
    // componente, así que el useEffect no volvería a correr. Este listener
    // garantiza datos frescos al volver de la página de detalle.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void cargar()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orgId, cargar])

  return { licitaciones, loading, error, recargar: () => { if (orgId) void cargar() } }
}
