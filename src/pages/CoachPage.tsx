import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { formatSleepDuration } from '../components/SleepDurationDial'
import {
  applyCoachPlanProposal,
  buildCoachContext,
  COACH_FIELD_LABELS,
  createCoachPlanApplication,
  getQwenApiKeyError,
  loadCoachMessages,
  loadQwenConfig,
  MAX_COACH_PROMPT_LENGTH,
  requestCoachReply,
  resolvePlanProposal,
  saveCoachMessages,
  saveQwenConfig,
  testQwenConnection,
  undoCoachPlanApplication,
  type CoachMessage,
  type CoachPlanScope,
  type QwenConfig,
  type ResolvedPlanChange,
} from '../lib/coach'
import { toLocalISODate } from '../lib/date'
import type { AppData } from '../types'

const QUICK_PROMPTS = [
  { label: '今日评估', prompt: '结合我今天的恢复状态和训练计划，判断今天是否适合按原计划训练，并告诉我最重要的一件事。', icon: 'recovery' as const },
  { label: '训练复盘', prompt: '复盘我最近一次训练：做得好的地方、需要注意的地方，以及下一次最值得改进的一点。', icon: 'history' as const },
  { label: '检查计划', prompt: '检查我当前一周训练计划和近期完成情况是否匹配。如果确实需要，请给出少量、保守的计划参数调整方案。', icon: 'calendar' as const },
  { label: '进步分析', prompt: '根据近期训练、体重和围度记录，分析我是否在稳定进步。没有足够数据时请直接说明还缺什么。', icon: 'trend' as const },
]

const makeMessage = (role: CoachMessage['role'], content: string, extra: Partial<CoachMessage> = {}): CoachMessage => ({
  id: `coach-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
  ...extra,
})

const formatTime = (iso: string) => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const formatChangeValue = (change: ResolvedPlanChange, value: number) => {
  if (change.field === 'restSeconds') return `${value} 秒`
  if (change.field === 'weightKg') return `${value} kg`
  if (change.field === 'rir') return `RIR ${value}`
  if (change.field === 'sets') return `${value} 组`
  return `${value} 次`
}

interface Props {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
}

export function CoachPage({ data, setData }: Props) {
  const [config, setConfig] = useState(loadQwenConfig)
  const [draftConfig, setDraftConfig] = useState(config)
  const [messages, setMessages] = useState(loadCoachMessages)
  const [input, setInput] = useState('')
  const [enableThinking, setEnableThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(!config.apiKey)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [connectionState, setConnectionState] = useState<'idle' | 'checking' | 'connected' | 'error'>(config.apiKey ? 'idle' : 'error')
  const [connectionMessage, setConnectionMessage] = useState(config.apiKey ? 'API Key 与对话仅在本次会话中可用' : '填写百炼 API Key 后即可开始')
  const abortRef = useRef<AbortController | null>(null)
  const isNearConversationBottomRef = useRef(true)
  const isAutoScrollingRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const scrollEndTimerRef = useRef<number | null>(null)
  const context = useMemo(() => buildCoachContext(data, undefined, config.shareDetailedContext), [data, config.shareDetailedContext])
  const latestRecovery = [...data.recoveryRecords].sort((a, b) => b.date.localeCompare(a.date))[0]
  const planDays = context.weeklyPlan.filter((day) => day.enabled).length

  const scrollToConversationBottom = (behavior: ScrollBehavior = 'smooth') => {
    const scrollToPageEnd = (mode: ScrollBehavior) => {
      const top = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      if (mode === 'smooth') {
        window.scrollTo({ top, behavior: 'smooth' })
        return
      }
      const previousScrollBehavior = document.documentElement.style.scrollBehavior
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo({ top, behavior: 'auto' })
      document.documentElement.style.scrollBehavior = previousScrollBehavior
    }
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    if (scrollEndTimerRef.current !== null) window.clearTimeout(scrollEndTimerRef.current)
    isAutoScrollingRef.current = true
    isNearConversationBottomRef.current = true
    setShowScrollToBottom(false)
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      scrollToPageEnd(behavior)
      scrollEndTimerRef.current = window.setTimeout(() => {
        scrollEndTimerRef.current = null
        scrollToPageEnd('auto')
        isNearConversationBottomRef.current = true
        setShowScrollToBottom(false)
        requestAnimationFrame(() => { isAutoScrollingRef.current = false })
      }, behavior === 'smooth' ? 500 : 80)
    })
  }

  useEffect(() => { saveCoachMessages(messages) }, [messages])
  useEffect(() => {
    if (isNearConversationBottomRef.current) scrollToConversationBottom('auto')
  }, [messages, isSending])
  useEffect(() => {
    const updateBottomState = () => {
      if (messages.length === 0) {
        isNearConversationBottomRef.current = true
        setShowScrollToBottom(false)
        return
      }
      if (isAutoScrollingRef.current) {
        setShowScrollToBottom(false)
        return
      }
      const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      const distanceFromBottom = Math.max(0, pageHeight - window.innerHeight - window.scrollY)
      const isNearBottom = distanceFromBottom <= 64
      isNearConversationBottomRef.current = isNearBottom
      setShowScrollToBottom(!isNearBottom)
    }
    updateBottomState()
    window.addEventListener('scroll', updateBottomState, { passive: true })
    window.addEventListener('resize', updateBottomState)
    return () => {
      window.removeEventListener('scroll', updateBottomState)
      window.removeEventListener('resize', updateBottomState)
    }
  }, [messages.length])
  useEffect(() => () => {
    abortRef.current?.abort()
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    if (scrollEndTimerRef.current !== null) window.clearTimeout(scrollEndTimerRef.current)
  }, [])

  const saveAndTest = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextConfig: QwenConfig = {
      ...draftConfig,
      apiKey: draftConfig.apiKey.trim(),
      model: 'qwen3.7-plus',
    }
    const apiKeyError = getQwenApiKeyError(nextConfig.apiKey)
    if (apiKeyError) {
      setConnectionState('error')
      setConnectionMessage(apiKeyError)
      return
    }
    setConnectionState('checking')
    setConnectionMessage('正在连接 Qwen3.7-Plus…')
    const controller = new AbortController()
    try {
      await testQwenConnection(nextConfig, controller.signal)
      setConfig(nextConfig)
      setDraftConfig(nextConfig)
      saveQwenConfig(nextConfig)
      setConnectionState('connected')
      setConnectionMessage('连接成功 · Qwen3.7-Plus 可用')
      setShowSettings(false)
    } catch (error) {
      setConnectionState('error')
      setConnectionMessage(error instanceof Error ? error.message : '连接失败，请检查配置')
    }
  }

  const clearKey = () => {
    const cleared = { ...config, apiKey: '' }
    setConfig(cleared)
    setDraftConfig(cleared)
    saveQwenConfig(cleared)
    setConnectionState('error')
    setConnectionMessage('API Key 已从本机移除')
  }

  const sendPrompt = async (prompt = input) => {
    const content = prompt.trim()
    if (!content || isSending) return
    if (content.length > MAX_COACH_PROMPT_LENGTH) {
      setConnectionState('error')
      setConnectionMessage(`问题最多 ${MAX_COACH_PROMPT_LENGTH} 个字符，请缩短后重试`)
      return
    }
    if (!config.apiKey) {
      setShowSettings(true)
      setConnectionState('error')
      setConnectionMessage('先连接百炼 API，教练才能回答')
      return
    }
    const userMessage = makeMessage('user', content)
    const requestMessages = [...messages, userMessage]
    isNearConversationBottomRef.current = true
    setMessages(requestMessages)
    setInput('')
    setIsSending(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await requestCoachReply({ config, messages: requestMessages, data, enableThinking, signal: controller.signal })
      setMessages((current) => [...current, makeMessage('assistant', result.reply.reply, { reply: result.reply, usage: result.usage })])
      setConnectionState('connected')
      setConnectionMessage('Qwen3.7-Plus 已连接')
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) => [...current, makeMessage('assistant', '本次生成已停止。', { error: true })])
      } else {
        const message = error instanceof Error ? error.message : '请求失败，请稍后重试。'
        setMessages((current) => [...current, makeMessage('assistant', message, { error: true })])
        setConnectionState('error')
        setConnectionMessage(message)
      }
    } finally {
      abortRef.current = null
      setIsSending(false)
    }
  }

  const applyProposal = (message: CoachMessage, scope: CoachPlanScope) => {
    const referenceDate = toLocalISODate()
    const proposal = resolvePlanProposal(data, message.reply?.planProposal ?? null, referenceDate)
    if (!proposal) return
    const application = createCoachPlanApplication(data, scope, referenceDate)
    setData((current) => applyCoachPlanProposal(current, proposal, scope, referenceDate))
    setMessages((current) => current.map((item) => item.id === message.id ? {
      ...item,
      proposalAppliedAt: application.appliedAt,
      proposalApplication: application,
      proposalUndoneAt: undefined,
    } : item))
  }

  const undoProposal = (message: CoachMessage) => {
    if (!message.proposalApplication) return
    setData((current) => undoCoachPlanApplication(current, message.proposalApplication!))
    setMessages((current) => current.map((item) => item.id === message.id ? {
      ...item,
      proposalAppliedAt: undefined,
      proposalApplication: undefined,
      proposalUndoneAt: new Date().toISOString(),
    } : item))
  }

  const clearConversation = () => {
    if (messages.length) setShowClearConfirm(true)
  }

  const confirmClearConversation = () => {
    setMessages([])
    setShowClearConfirm(false)
    setShowScrollToBottom(false)
  }

  return <main className="page coach-page">
    <header className="page-header coach-header">
      <div><p className="eyebrow">QWEN3.7 · 最少数据默认</p><h1>AI 教练</h1></div>
      <button className={`header-icon coach-settings-button ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings((value) => !value)} aria-label="AI 教练连接设置"><Icon name="settings" /></button>
    </header>

    <section className="coach-status-card">
      <div className="coach-status-heading"><span className="coach-orb"><Icon name="spark" size={28} /></span><div><p className="eyebrow">练迹教练在线</p><h2>{config.shareDetailedContext ? '详细上下文已由你主动开启' : '默认只发送计划与统计汇总'}</h2></div><span className={`connection-dot ${connectionState}`} aria-label={connectionMessage} /></div>
      <div className="coach-context-stats">
        <div><small>训练档案</small><strong>{data.workouts.length}</strong><span>次</span></div>
        <div><small>当前计划</small><strong>{planDays}</strong><span>天/周</span></div>
        <div><small>最近睡眠</small>{latestRecovery ? <strong className="coach-sleep-value">{formatSleepDuration(latestRecovery.sleepHours)}</strong> : <><strong>—</strong><span>未记录</span></>}</div>
      </div>
      <p className={`connection-message ${connectionState}`}><span />{connectionMessage}</p>
    </section>

    {showSettings && <form className="card coach-config-card" onSubmit={saveAndTest}>
      <div className="section-heading"><div><p className="eyebrow">SECURE CONNECTION</p><h2>连接百炼 API</h2></div><span>仅本次会话</span></div>
      <label>百炼 API Key<input type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={256} value={draftConfig.apiKey} placeholder="sk-…" onChange={(event) => setDraftConfig((current) => ({ ...current, apiKey: event.target.value }))} /></label>
      <div className="coach-model-row"><span><small>当前模型</small><strong>Qwen3.7-Plus</strong></span><em>北京地域</em></div>
      <label>发送给 AI 的上下文</label>
      <div className="segmented">
        <button type="button" className={!draftConfig.shareDetailedContext ? 'active' : ''} onClick={() => setDraftConfig((current) => ({ ...current, shareDetailedContext: false }))}>最少数据（推荐）</button>
        <button type="button" className={draftConfig.shareDetailedContext ? 'active' : ''} onClick={() => setDraftConfig((current) => ({ ...current, shareDetailedContext: true }))}>详细数据</button>
      </div>
      <p className="coach-security-note"><Icon name={draftConfig.shareDetailedContext ? 'warning' : 'check'} size={16} /><span><strong>{draftConfig.shareDetailedContext ? '详细模式会发送健康记录' : '最少数据模式'}</strong><small>{draftConfig.shareDetailedContext ? '会发送年龄、身体指标、近期训练、恢复与备注；姓名始终不会发送' : '只发送器械、当前计划与匿名统计汇总；不发送姓名、年龄、身体围度、恢复记录或备注'}</small></span></p>
      <p className="coach-security-note"><Icon name="check" size={16} /><span><strong>固定安全连接</strong><small>密钥与对话仅存于当前会话，请求只发送至 dashscope.aliyuncs.com</small></span></p>
      <p className={`form-message ${connectionState === 'connected' ? 'success' : ''}`}>{connectionState === 'checking' ? <span className="coach-spinner small" /> : <Icon name={connectionState === 'error' ? 'warning' : 'info'} size={16} />}{connectionMessage}</p>
      <div className="coach-config-actions"><a className="button secondary" href="https://bailian.console.aliyun.com/?tab=model#/api-key" target="_blank" rel="noreferrer">获取 API Key</a><button className="button primary" type="submit" disabled={connectionState === 'checking'}>{connectionState === 'checking' ? '测试中…' : '保存并测试'}</button></div>
      {config.apiKey && <button type="button" className="text-button coach-remove-key" onClick={clearKey}>移除本机 API Key</button>}
    </form>}

    {messages.length === 0 && <section className="coach-welcome">
      <span><Icon name="spark" size={26} /></span>
      <div><p className="eyebrow">第一次见面</p><h2>你好，{data.profile.name}</h2><p>{config.shareDetailedContext ? '你已主动开启详细上下文；提问时会发送近期训练、身体和恢复数据，姓名始终不会发送。' : '默认只发送当前计划与匿名统计汇总，不发送姓名、身体围度、恢复记录或备注。'} 可以从下面的快捷问题开始，也可以直接问我。</p></div>
    </section>}

    <section className="coach-quick-section" aria-label="快捷提问">
      <div className="coach-quick-track">{QUICK_PROMPTS.map((item) => <button key={item.label} onClick={() => void sendPrompt(item.prompt)} disabled={isSending}><Icon name={item.icon} size={17} /><span><strong>{item.label}</strong><small>{item.prompt.slice(0, 18)}…</small></span><Icon name="chevron" size={15} /></button>)}</div>
    </section>

    {messages.length > 0 && <section className="coach-conversation">
      <div className="coach-conversation-heading"><span>当前会话对话</span><button onClick={clearConversation} disabled={isSending}><Icon name="trash" size={14} />清空</button></div>
      {messages.map((message) => {
        const proposal = message.role === 'assistant' && !message.proposalAppliedAt ? resolvePlanProposal(data, message.reply?.planProposal ?? null) : null
        return <article className={`coach-message ${message.role} ${message.error ? 'error' : ''}`} key={message.id}>
          {message.role === 'assistant' && <span className="coach-avatar"><Icon name={message.error ? 'warning' : 'spark'} size={17} /></span>}
          <div className="coach-message-body">
            <div className="coach-message-meta"><strong>{message.role === 'user' ? '你' : '练迹教练'}</strong><time>{formatTime(message.createdAt)}</time></div>
            <div className="coach-message-copy">{message.content.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)}</div>
            {message.reply?.insights.length ? <div className="coach-insights">{message.reply.insights.map((insight, index) => <div className={insight.tone} key={`${insight.title}-${index}`}><span /><strong>{insight.title}</strong><p>{insight.detail}</p></div>)}</div> : null}
            {proposal && <section className="coach-plan-proposal">
              <header><span><Icon name="calendar" size={17} /></span><div><p className="eyebrow">PLAN PROPOSAL</p><h3>{proposal.title}</h3></div></header>
              <p>{proposal.rationale}</p>
              <div className="coach-plan-changes">{proposal.changes.map((change, index) => <div key={`${change.exerciseId}-${change.field}-${index}`}><span><small>{change.dayTitle} · {COACH_FIELD_LABELS[change.field]}</small><strong>{change.exerciseName}</strong><em>{change.reason}</em></span><b>{formatChangeValue(change, change.before)}<Icon name="chevron" size={13} />{formatChangeValue(change, change.value)}</b></div>)}</div>
              <div className="coach-plan-actions">
                <button className="button secondary" onClick={() => applyProposal(message, 'current-week')}><Icon name="calendar" size={16} />仅应用到本周</button>
                <button className="button primary" onClick={() => applyProposal(message, 'all-future')}><Icon name="check" size={16} />应用到今后所有计划</button>
              </div>
              <small className="coach-proposal-note">本周方案只影响当前自然周；永久方案会更新当前周与今后周计划。</small>
              {message.proposalUndoneAt && <small className="coach-undone-note">上次调整已撤回，你可以重新选择应用范围。</small>}
            </section>}
            {message.proposalAppliedAt && <div className="coach-applied"><span><Icon name="check" size={15} />{message.proposalApplication?.scope === 'current-week' ? '调整仅应用到本周计划' : '调整已应用到今后所有计划'}</span>{message.proposalApplication && <button type="button" onClick={() => undoProposal(message)}>撤回本次调整</button>}</div>}
            {message.reply?.suggestions.length ? <div className="coach-follow-ups">{message.reply.suggestions.map((suggestion) => <button key={suggestion} disabled={isSending} onClick={() => void sendPrompt(suggestion)}>{suggestion}</button>)}</div> : null}
            {message.usage && message.usage.totalTokens > 0 && <small className="coach-usage">本次 {message.usage.totalTokens.toLocaleString()} tokens · 输入 {message.usage.inputTokens.toLocaleString()} / 输出 {message.usage.outputTokens.toLocaleString()}</small>}
          </div>
        </article>
      })}
      {isSending && <article className="coach-message assistant"><span className="coach-avatar"><Icon name="spark" size={17} /></span><div className="coach-message-body coach-typing"><span className="coach-spinner" /><div><strong>{enableThinking ? '正在深度分析训练档案' : '正在整理你的训练建议'}</strong><small>Qwen3.7-Plus</small></div><button onClick={() => abortRef.current?.abort()}>停止</button></div></article>}
      <div className="coach-conversation-end" />
    </section>}

    {showScrollToBottom && createPortal(<button type="button" className="coach-jump-bottom" onClick={() => scrollToConversationBottom()}><Icon name="chevron" size={16} />回到底部</button>, document.body)}

    <section className="coach-composer-wrap">
      <div className="coach-mode-row"><button className={enableThinking ? 'active' : ''} onClick={() => setEnableThinking((value) => !value)} aria-pressed={enableThinking}><Icon name="spark" size={14} />深度分析 {enableThinking ? '开' : '关'}</button><span>{enableThinking ? '更适合复杂计划，速度稍慢' : '适合日常问答，更快更省'}</span></div>
      <div className="coach-composer"><textarea rows={1} maxLength={MAX_COACH_PROMPT_LENGTH} value={input} placeholder="问训练、恢复、进步或计划…" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendPrompt() } }} /><button disabled={!input.trim() || isSending} onClick={() => void sendPrompt()} aria-label="发送给 AI 教练"><Icon name="chevron" size={21} /></button></div>
    </section>
    <ConfirmDialog
      open={showClearConfirm}
      eyebrow="清空当前会话"
      title="清空全部对话？"
      message="当前浏览器会话中的 AI 教练对话将被删除，清空后无法恢复。"
      details={['训练计划和历史训练记录不会改变', 'API Key 仅在当前会话中继续保留']}
      icon="trash"
      confirmLabel="清空对话"
      onCancel={() => setShowClearConfirm(false)}
      onConfirm={confirmClearConversation}
    />
  </main>
}
