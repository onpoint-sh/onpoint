import { X } from 'lucide-react'

type TabCloseButtonProps = {
  label: string
  onClick: () => void
  className?: string
  iconClassName?: string
  tabIndex?: number
}

function TabCloseButton({
  label,
  onClick,
  className = 'tab-close-button',
  iconClassName = 'tab-close-button-icon size-3',
  tabIndex = -1
}: TabCloseButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={className}
      tabIndex={tabIndex}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <X className={iconClassName} />
    </button>
  )
}

export { TabCloseButton }
export type { TabCloseButtonProps }
