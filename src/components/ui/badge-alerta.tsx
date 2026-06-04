'use client'

import { type CategoriaAlerta, ALERTAS } from '@/types'
import { cn } from '@/lib/utils/cn'

interface BadgeAlertaProps {
  categoria: CategoriaAlerta
  size?: 'sm' | 'md'
  className?: string
}

export function BadgeAlerta({ categoria, size = 'md', className }: BadgeAlertaProps) {
  const config = ALERTAS[categoria]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
      style={{
        backgroundColor: config.color,
        color: config.textColor,
        borderColor: config.borderColor,
      }}
    >
      {config.label}
    </span>
  )
}
