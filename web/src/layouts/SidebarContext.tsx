import { createContext, useContext, type ReactNode } from 'react'

type SidebarCtx = { openSidebar: () => void }

const SidebarContext = createContext<SidebarCtx>({ openSidebar: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <SidebarContext.Provider value={{ openSidebar: onOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}
