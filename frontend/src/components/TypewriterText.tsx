import React, { useState, useEffect, useRef } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
  showCursor?: boolean
  cursorChar?: string
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speed = 30,
  onComplete,
  showCursor = true,
  cursorChar = '|'
}) => {
  const [displayText, setDisplayText] = useState('')
  const previousTextRef = useRef('')

  useEffect(() => {
    if (!text) {
      setDisplayText('')
      previousTextRef.current = ''
      return
    }

    if (text !== previousTextRef.current) {
      const previousLength = previousTextRef.current.length
      const newText = text.substring(previousLength)
      
      if (newText) {
        let charIndex = 0
        const interval = setInterval(() => {
          if (charIndex < newText.length) {
            setDisplayText(prev => prev + newText[charIndex])
            charIndex++
          } else {
            clearInterval(interval)
            previousTextRef.current = text
            onComplete?.()
          }
        }, speed)

        return () => clearInterval(interval)
      }
    }
  }, [text, speed, onComplete])

  useEffect(() => {
    if (text && text.startsWith(displayText) && text !== displayText) {
      const remaining = text.substring(displayText.length)
      let charIndex = 0
      const interval = setInterval(() => {
        if (charIndex < remaining.length) {
          setDisplayText(prev => prev + remaining[charIndex])
          charIndex++
        } else {
          clearInterval(interval)
          onComplete?.()
        }
      }, speed)

      return () => clearInterval(interval)
    }
  }, [text, displayText, speed, onComplete])

  return (
    <span className="typewriter-text">
      {displayText}
      {showCursor && (
        <span 
          className="typewriter-cursor"
          style={{
            animation: 'blink 1s infinite',
            marginLeft: '2px',
            fontWeight: 'bold'
          }}
        >
          {cursorChar}
        </span>
      )}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .typewriter-text {
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .typewriter-cursor {
          color: #1890ff;
          font-weight: bold;
        }
      `}</style>
    </span>
  )
}

export default TypewriterText
