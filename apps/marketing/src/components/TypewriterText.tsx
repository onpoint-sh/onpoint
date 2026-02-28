import { useEffect, useState } from 'react'

interface Segment {
  text: string
  className?: string
  style?: React.CSSProperties
}

interface TypewriterTextProps {
  segments: Segment[]
  speed?: number
  delay?: number
}

export default function TypewriterText({
  segments,
  speed = 40,
  delay = 600
}: TypewriterTextProps): React.JSX.Element {
  const [displayedChars, setDisplayedChars] = useState(0)

  const totalChars = segments.reduce((sum, seg) => sum + seg.text.length, 0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (displayedChars >= totalChars) return

      const interval = setInterval(() => {
        setDisplayedChars((prev) => {
          if (prev >= totalChars) {
            clearInterval(interval)
            return prev
          }
          return prev + 1
        })
      }, speed)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [totalChars, speed, delay, displayedChars])

  const segmentOffsets = segments.reduce<number[]>((offsets, seg, i) => {
    offsets.push(i === 0 ? 0 : offsets[i - 1] + segments[i - 1].text.length)
    return offsets
  }, [])

  return (
    <span>
      {segments.map((segment, i) => {
        const segStart = segmentOffsets[i]
        const visibleCount = Math.max(0, Math.min(segment.text.length, displayedChars - segStart))
        const visibleText = segment.text.slice(0, visibleCount)

        return (
          <span key={i} className={segment.className} style={segment.style}>
            {visibleText}
          </span>
        )
      })}
      {displayedChars < totalChars && <span className="animate-pulse text-foreground/60">|</span>}
    </span>
  )
}
