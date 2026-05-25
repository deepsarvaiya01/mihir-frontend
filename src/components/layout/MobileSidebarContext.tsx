import { createContext, useContext } from 'react'

type MobileSidebarContextType = {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const MobileSidebarContext = createContext<MobileSidebarContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
})

export function useMobileSidebar() {
  return useContext(MobileSidebarContext)
}
