'use client'

import { useRole, type Role } from '../contexts/RoleContext'

const ROLES: { value: Role; label: string }[] = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'mediator', label: 'Mediator' },
]

export function RoleSwitcher() {
  const { role, setRole } = useRole()
  return (
    <div className="flex items-center gap-2 text-sm" aria-label="View as role">
      <span className="text-gray-500 font-medium">View as:</span>
      {ROLES.map((r) => (
        <button
          key={r.value}
          onClick={() => setRole(r.value)}
          aria-pressed={role === r.value}
          className={`px-3 py-1 rounded-full border transition-colors ${
            role === r.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
