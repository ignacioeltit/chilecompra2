import { Sidebar } from '@/components/layout/Sidebar'
import { CommandPalette, CommandPaletteTriggerMobile } from '@/components/ui/CommandPalette'
import { LicitacionesProvider } from '@/components/ui/CommandPaletteProvider'

export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LicitacionesProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto pb-16 md:pb-0">{children}</main>
        <CommandPalette />
        <CommandPaletteTriggerMobile />
      </div>
    </LicitacionesProvider>
  )
}
