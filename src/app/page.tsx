import { redirect } from 'next/navigation'

// La ruta raíz redirige al dashboard (middleware maneja auth)
export default function RootPage() {
  redirect('/dashboard')
}
