import { Sidebar } from '@/components/layout/Sidebar'

// Todas las rutas bajo (app) requieren auth y usan Supabase en runtime
export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto pb-16 md:pb-0">{children}</main>
    </div>
  )
}
