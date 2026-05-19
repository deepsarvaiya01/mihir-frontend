import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin text-indigo-600 ${sizes[size]} ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  )
}
