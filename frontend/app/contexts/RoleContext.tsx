'use client'

import React, { createContext, useContext, useState } from 'react'

export type Role = 'tenant' | 'landlord' | 'mediator'

interface RoleContextValue {
  role: Role
  setRole: (r: Role) => void
}

const RoleContext = createContext<RoleContextValue>({
  role: 'tenant',
  setRole: () => {},
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('tenant')
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
