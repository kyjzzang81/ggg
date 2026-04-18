import type { ReactNode } from 'react'
import { PAGE_STATUS_COPY } from '../ui/pageStatus'

type Variant = 'loading' | 'empty' | 'error'

const classFor: Record<Variant, string> = {
  loading: 'page-status page-status--loading',
  empty: 'page-status page-status--empty',
  error: 'page-status page-status--error',
}

export function PageStatus({
  variant,
  message,
  className,
}: {
  variant: Variant
  message?: ReactNode
  className?: string
}) {
  const text =
    variant === 'loading'
      ? (message ?? PAGE_STATUS_COPY.loading)
      : variant === 'empty'
        ? (message ?? PAGE_STATUS_COPY.empty)
        : (message ?? PAGE_STATUS_COPY.error)

  return <p className={[classFor[variant], className].filter(Boolean).join(' ')}>{text}</p>
}
