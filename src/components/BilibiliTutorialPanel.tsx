import { useEffect, useState } from 'react'
import { createBilibiliTutorial } from '../data/exerciseTutorials'
import type { ExerciseTutorial } from '../types'
import { Icon } from './Icon'
import { VideoTutorial } from './VideoTutorial'

interface Props {
  exerciseName: string
  tutorial?: ExerciseTutorial | null
  onSave: (tutorial: ExerciseTutorial | null) => void
}

export function BilibiliTutorialPanel({ exerciseName, tutorial, onSave }: Props) {
  const [input, setInput] = useState(tutorial?.url ?? '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setInput(tutorial?.url ?? '')
    setMessage('')
  }, [exerciseName, tutorial?.url])

  const parseAndSave = () => {
    const parsed = createBilibiliTutorial(input, exerciseName, tutorial)
    if (!parsed) {
      setMessage('未识别到 BV 号或 av 号，请粘贴完整的 B 站视频地址。')
      return
    }
    onSave(parsed)
    setInput(parsed.url)
    setMessage('已解析并保存；视频只会在你点按播放后加载。')
  }

  return <details className="database-tutorial">
    <summary>
      <span><Icon name="play" size={17} /><strong>B站可选教程</strong></span>
      <span><em>{tutorial ? '已设置' : '未设置'}</em><Icon name="chevron" size={16} /></span>
    </summary>
    <div className="database-tutorial-panel">
      <p>可为这个动作粘贴一个 B 站视频地址。应用只解析 BV/av 编号，不会自动打开外部链接。</p>
      <label>B站视频链接<input value={input} onChange={(event) => { setInput(event.target.value); setMessage('') }} placeholder="https://www.bilibili.com/video/BV..." inputMode="url" /></label>
      <div className="database-tutorial-actions">
        <button type="button" className="button primary" onClick={parseAndSave}>解析并保存</button>
        {tutorial && <button type="button" className="button secondary" onClick={() => { onSave(null); setInput(''); setMessage('已移除这个动作的可选教程。') }}>移除教程</button>}
      </div>
      {message && <p className="database-tutorial-message" role="status">{message}</p>}
      {tutorial && <VideoTutorial tutorial={tutorial} />}
    </div>
  </details>
}
