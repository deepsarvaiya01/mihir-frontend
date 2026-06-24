import type { ReactNode } from 'react'

interface PageContentProps {
  children: ReactNode
  className?: string
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl' | 'full'
}

const maxWidths = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
}

export function PageContent({ children, className = '', maxWidth = 'full' }: PageContentProps) {
  return (
    <div className={`p-6 ${maxWidths[maxWidth]} ${maxWidth !== 'full' ? 'mx-auto w-full' : ''} ${className}`}>
      {children}
    </div>
  )
}
