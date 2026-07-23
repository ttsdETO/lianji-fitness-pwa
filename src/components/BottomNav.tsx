import { Icon, type IconName } from './Icon'

export type TabId = 'today' | 'history' | 'coach' | 'body' | 'recovery' | 'settings'

const tabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'today', label: '今日', icon: 'today' },
  { id: 'history', label: '记录', icon: 'history' },
  { id: 'coach', label: '教练', icon: 'spark' },
  { id: 'body', label: '身体', icon: 'body' },
  { id: 'recovery', label: '恢复', icon: 'recovery' },
  { id: 'settings', label: '设置', icon: 'settings' },
]

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return <nav className="bottom-nav" aria-label="主导航">
    {tabs.map((tab) => <button key={tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}>
      <Icon name={tab.icon} size={21} />
      <span>{tab.label}</span>
    </button>)}
  </nav>
}
