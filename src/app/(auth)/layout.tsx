// Páginas de auth: no prerender — usan Supabase en runtime
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
