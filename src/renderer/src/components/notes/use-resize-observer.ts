import { useEffect } from 'react'

function useResizeObserver(
  ref: React.RefObject<HTMLElement | null>,
  callback: (entry: ResizeObserverEntry) => void
): void {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) callback(entry)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, callback])
}

export default useResizeObserver
