import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// En Next.js 16, el archivo se llama proxy.ts y la función exportada es "proxy"
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
