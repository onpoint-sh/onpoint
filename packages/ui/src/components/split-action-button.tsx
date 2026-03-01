import * as React from 'react'

import { cn } from '../lib/utils'

type SplitActionButtonProps = {
  onPrimaryClick: () => void
  onSecondaryClick?: () => void
  primaryLabel: string
  secondaryLabel: string
  groupLabel?: string
  className?: string
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function SplitActionButton({
  onPrimaryClick,
  onSecondaryClick,
  primaryLabel,
  secondaryLabel,
  groupLabel,
  className
}: SplitActionButtonProps): React.JSX.Element {
  const handleSecondaryClick = onSecondaryClick ?? onPrimaryClick

  return (
    <div
      role="group"
      aria-label={groupLabel ?? primaryLabel}
      className={cn(
        'group inline-flex h-6 items-center overflow-hidden rounded-[0.38rem] border border-transparent bg-transparent transition-[border-color,background-color] duration-[120ms] hover:border-[color-mix(in_oklch,var(--border)_84%,var(--foreground)_16%)] hover:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--muted))] focus-within:border-[color-mix(in_oklch,var(--border)_84%,var(--foreground)_16%)] focus-within:bg-[color-mix(in_oklch,var(--foreground)_6%,var(--muted))]',
        className
      )}
    >
      <button
        type="button"
        className="inline-flex h-full w-6 items-center justify-center border-r border-r-transparent bg-transparent text-muted-foreground transition-[color,background-color,border-color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--foreground)_11%,var(--muted))] hover:text-foreground focus-visible:outline-none focus-visible:bg-[color-mix(in_oklch,var(--ring)_16%,transparent)] focus-visible:text-foreground group-hover:border-r-[color-mix(in_oklch,var(--border)_80%,var(--foreground)_20%)] group-focus-within:border-r-[color-mix(in_oklch,var(--border)_80%,var(--foreground)_20%)]"
        onClick={onPrimaryClick}
        aria-label={primaryLabel}
        title={primaryLabel}
      >
        <PlusIcon className="size-3.5" />
      </button>
      <button
        type="button"
        className="inline-flex h-full w-[0.95rem] items-center justify-center bg-transparent text-muted-foreground transition-[color,background-color] duration-[120ms] hover:bg-[color-mix(in_oklch,var(--foreground)_11%,var(--muted))] hover:text-foreground focus-visible:outline-none focus-visible:bg-[color-mix(in_oklch,var(--ring)_16%,transparent)] focus-visible:text-foreground"
        onClick={handleSecondaryClick}
        aria-label={secondaryLabel}
        title={secondaryLabel}
      >
        <ChevronDownIcon className="size-3.5" />
      </button>
    </div>
  )
}

export { SplitActionButton, type SplitActionButtonProps }
