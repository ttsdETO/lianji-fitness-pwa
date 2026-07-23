import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav, type TabId } from './components/BottomNav'
import { Icon } from './components/Icon'
import { RestTimer, type RestTimerState } from './components/RestTimer'
import { TodayPage } from './pages/TodayPage'
import { loadAppData, saveAppData } from './lib/storage'
import { getCountdownCue, playCountdownCue, unlockCountdownAudio } from './lib/countdownAudio'

const BodyPage = lazy(() => import('./pages/BodyPage').then((module) => ({ default: module.BodyPage })))
const CoachPage = lazy(() => import('./pages/CoachPage').then((module) => ({ default: module.CoachPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage').then((module) => ({ default: module.RecoveryPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function PageLoading() {
  return <main className="page"><div className="empty-inline" role="status" aria-live="polite">正在加载…</div></main>
}

export default function App() {
  const [data, setData] = useState(loadAppData)
  const [activeTab, setActiveTab] = useState<TabId>('today')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [timer, setTimer] = useState<RestTimerState | null>(null)
  const timerEndRef = useRef<number | null>(null)
  const lastTimerCueSecondRef = useRef<number | null>(null)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

  useEffect(() => saveAppData(data), [data])

  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = data.settings.theme
    const colors = { light: '#f3f0e8', dark: '#0f1410', system: window.matchMedia('(prefers-color-scheme: dark)').matches ? '#0f1410' : '#f3f0e8' }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[data.settings.theme])
  }, [data.settings.theme])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (!timer?.running) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(((timerEndRef.current ?? Date.now()) - Date.now()) / 1000))
      setTimer((current) => current ? { ...current, remaining, running: remaining > 0 } : null)
      playCountdownCue(getCountdownCue(lastTimerCueSecondRef.current, remaining))
      lastTimerCueSecondRef.current = remaining
      if (remaining === 0) {
        timerEndRef.current = null
        navigator.vibrate?.([180, 100, 180])
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [timer?.running])

  const startRest = useCallback((seconds: number, exerciseName: string) => {
    unlockCountdownAudio()
    lastTimerCueSecondRef.current = null
    timerEndRef.current = Date.now() + seconds * 1000
    setTimer({ duration: seconds, remaining: seconds, running: true, exerciseName })
  }, [])

  const toggleTimer = () => {
    unlockCountdownAudio()
    setTimer((current) => {
      if (!current || current.remaining === 0) return current
      if (current.running) {
        timerEndRef.current = null
        return { ...current, running: false }
      }
      lastTimerCueSecondRef.current = null
      timerEndRef.current = Date.now() + current.remaining * 1000
      return { ...current, running: true }
    })
  }

  const addTimer = (seconds: number) => {
    unlockCountdownAudio()
    setTimer((current) => {
      if (!current) return current
      const remaining = current.remaining + seconds
      if (current.running) timerEndRef.current = Date.now() + remaining * 1000
      return { ...current, duration: Math.max(current.duration, remaining), remaining, running: true }
    })
  }

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setInstallPrompt(null)
      return
    }
    const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    window.alert(isiOS ? '在 Safari 底部点“分享”按钮，再选择“添加到主屏幕”。' : '请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。若没有该选项，请先用构建后的 HTTPS 地址打开应用。')
  }

  const changeTab = (tab: TabId) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className={`app-shell ${timer ? 'has-timer' : ''}`}>
    <Suspense fallback={<PageLoading />}>
      {activeTab === 'today' && <TodayPage data={data} setData={setData} onStartRest={startRest} onStopRest={() => setTimer(null)} onNavigate={changeTab} />}
      {activeTab === 'history' && <HistoryPage data={data} />}
      {activeTab === 'coach' && <CoachPage data={data} setData={setData} />}
      {activeTab === 'body' && <BodyPage data={data} setData={setData} />}
      {activeTab === 'recovery' && <RecoveryPage data={data} setData={setData} />}
      {activeTab === 'settings' && <SettingsPage data={data} setData={setData} canInstall={Boolean(installPrompt)} isStandalone={isStandalone} onInstall={() => void install()} />}
    </Suspense>
    <RestTimer timer={timer} onToggle={toggleTimer} onAdd={addTimer} onFinish={() => setTimer(null)} />
    <BottomNav active={activeTab} onChange={changeTab} />
    <div className="desktop-safety"><Icon name="warning" size={16} />关节刺痛或锐痛时停止动作</div>
  </div>
}
