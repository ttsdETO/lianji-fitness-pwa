import { useEffect, useState } from 'react'
import type { ExerciseTutorial } from '../types'
import { Icon } from './Icon'

function getEmbedUrl(tutorial: ExerciseTutorial) {
  const id = encodeURIComponent(tutorial.videoId)
  const videoParam = tutorial.videoId.toLowerCase().startsWith('av')
    ? `aid=${encodeURIComponent(tutorial.videoId.slice(2))}`
    : `bvid=${id}`
  return `https://player.bilibili.com/player.html?${videoParam}&page=1&autoplay=0&high_quality=1`
}

export function VideoTutorial({ tutorial }: { tutorial: ExerciseTutorial }) {
  const [playing, setPlaying] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    setPlaying(false)
  }, [tutorial.videoId])

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  return <section className="detail-section tutorial-section" aria-label="视频教程">
    <div className="tutorial-heading">
      <div>
        <p className="eyebrow">动作示范</p>
        <h3>视频教程</h3>
      </div>
      <span className="source-badge">哔哩哔哩</span>
    </div>

    {playing && online ? <div className="tutorial-player">
      <iframe
        src={getEmbedUrl(tutorial)}
        title={`${tutorial.title}视频教程`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div> : <button
      type="button"
      className="tutorial-preview"
      onClick={() => setPlaying(true)}
      disabled={!online}
      aria-label={online ? `播放${tutorial.title}` : '当前离线，视频不可播放'}
    >
      <span className="tutorial-play"><Icon name="play" size={28} /></span>
      <span>
        <strong>{tutorial.title}</strong>
        <small>{online ? '点按加载在线视频' : '当前离线 · 文字指导仍可使用'}</small>
      </span>
    </button>}

    <div className="tutorial-meta">
      <span>{tutorial.creator ? `来源：${tutorial.creator}` : '已解析 B 站视频'}</span>
    </div>
    <p className="tutorial-note">第三方视频需联网播放；实际训练以无痛、可控和应用内动作要点为准。</p>
  </section>
}
