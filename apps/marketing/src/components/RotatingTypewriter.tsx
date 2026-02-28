import { useEffect, useRef, useState } from 'react'

interface RotatingTypewriterProps {
  words: string[]
  colors?: (string | undefined)[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  initialDelay?: number
  className?: string
}

export default function RotatingTypewriter({
  words,
  colors,
  typingSpeed = 60,
  deletingSpeed = 30,
  pauseDuration = 2000,
  initialDelay = 600,
  className
}: RotatingTypewriterProps): React.JSX.Element {
  const [wordChars, setWordChars] = useState(0)
  const [wordIndex, setWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [started, setStarted] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const tickRef = useRef<(() => void) | null>(null)

  const currentWord = words[wordIndex] ?? ''

  useEffect(() => {
    tickRef.current = (): void => {
      if (!isDeleting) {
        if (wordChars < currentWord.length) {
          setWordChars((c) => c + 1)
          timeoutRef.current = setTimeout(() => tickRef.current?.(), typingSpeed)
        } else {
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true)
            timeoutRef.current = setTimeout(() => tickRef.current?.(), deletingSpeed)
          }, pauseDuration)
        }
      } else {
        if (wordChars > 0) {
          setWordChars((c) => c - 1)
          timeoutRef.current = setTimeout(() => tickRef.current?.(), deletingSpeed)
        } else {
          setIsDeleting(false)
          setWordIndex((i) => (i + 1) % words.length)
          timeoutRef.current = setTimeout(() => tickRef.current?.(), typingSpeed)
        }
      }
    }
  }, [
    isDeleting,
    wordChars,
    currentWord.length,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    words.length
  ])

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), initialDelay)
    return (): void => clearTimeout(t)
  }, [initialDelay])

  useEffect(() => {
    if (!started) return
    timeoutRef.current = setTimeout(() => tickRef.current?.(), typingSpeed)
    return (): void => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [started, typingSpeed])

  const showCursor = wordChars < currentWord.length || isDeleting

  const color = colors?.[wordIndex]

  return (
    <span className={className} style={color ? { color } : undefined}>
      {currentWord.slice(0, wordChars)}
      {showCursor && (
        <span
          className="ml-px inline-block w-[2px] animate-pulse bg-foreground/50"
          style={{ height: '0.85em' }}
        />
      )}
    </span>
  )
}
