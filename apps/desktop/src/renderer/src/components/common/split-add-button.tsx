import { ChevronDown, Plus } from 'lucide-react'

type SplitAddButtonProps = {
  onPrimaryClick: () => void
  onSecondaryClick: () => void
  primaryLabel: string
  secondaryLabel: string
  groupLabel: string
  className?: string
}

function SplitAddButton({
  onPrimaryClick,
  onSecondaryClick,
  primaryLabel,
  secondaryLabel,
  groupLabel,
  className
}: SplitAddButtonProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={['bottom-panel-toolbar-split-add', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="bottom-panel-toolbar-split-add-btn"
        onClick={onPrimaryClick}
        title={primaryLabel}
        aria-label={primaryLabel}
      >
        <Plus className="size-3.5" />
      </button>
      <button
        type="button"
        className="bottom-panel-toolbar-split-add-btn"
        onClick={onSecondaryClick}
        title={secondaryLabel}
        aria-label={secondaryLabel}
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  )
}

export { SplitAddButton, type SplitAddButtonProps }
