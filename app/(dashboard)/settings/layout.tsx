import { ReactNode } from 'react'
import { SettingsSidebar } from './settings-sidebar'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-8 md:gap-12 min-h-[500px]">
      <aside className="w-full md:w-60 shrink-0">
        <SettingsSidebar />
      </aside>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
