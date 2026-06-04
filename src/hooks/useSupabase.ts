'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type User } from '@supabase/supabase-js'
import { type Usuario } from '@/types'

// Singleton — misma razón que en useRealtimeLicitaciones:
// createClient() fuera del hook evita que useEffect se dispare en cada render.
const supabase = createClient()

export function useSupabase() {
  return supabase
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarUsuario() {
      setLoading(true)

      const { data: userData } = await supabase.auth.getUser()
      const authUser = userData.user
      setUser(authUser)

      if (authUser) {
        const { data: perfilData, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle()

        if (error) console.error('Error cargando perfil:', error)
        setPerfil(perfilData as Usuario | null)
      } else {
        setPerfil(null)
      }

      setLoading(false)
    }

    void cargarUsuario()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void cargarUsuario()
    })

    return () => subscription.unsubscribe()
  }, []) // deps vacío: supabase es una referencia estable (singleton)

  return { user, perfil, loading }
}
