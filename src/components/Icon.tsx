import type { SVGProps } from 'react'

export type IconName = 'today' | 'history' | 'body' | 'recovery' | 'settings' | 'timer' | 'check' | 'info' | 'moon' | 'warning' | 'download' | 'upload' | 'trash' | 'chevron' | 'play' | 'pause' | 'close' | 'spark' | 'calendar' | 'plus' | 'trend'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 22, ...props }: IconProps) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, React.ReactNode> = {
    today: <><path d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="m8 14 2.2 2.2L16 11"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    body: <><circle cx="12" cy="4.5" r="2.2"/><path d="M8 21v-5l-2-4 2-5h8l2 5-2 4v5M8.5 10h7M12 10v5"/></>,
    recovery: <><path d="M20 13c0 5-3.5 8-8 8s-8-3-8-8 3-9 8-11c5 2 8 6 8 11Z"/><path d="M8 14c2 0 3-1 4-4 1 3 2 4 4 4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.08a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.08A1.7 1.7 0 0 0 4.63 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.08A1.7 1.7 0 0 0 15.5 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.37.3.72.6 1 .28.27.64.4 1 .4h.08v4H21a1.7 1.7 0 0 0-1.6.6Z"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    warning: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    play: <path d="m8 5 11 7-11 7V5Z"/>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    trend: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
  }
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...common} {...props}>{paths[name]}</svg>
}
