import { addDays } from './date'
import type { RecoveryAdvice, RecoveryRecord } from '../types'

export const getRecoveryAdvice = (date: string, records: RecoveryRecord[]): RecoveryAdvice => {
  const today = records.find((item) => item.date === date)
  const yesterday = records.find((item) => item.date === addDays(date, -1))

  if (today?.jointPain) {
    return {
      level: 'pain',
      title: '先处理关节疼痛',
      message: `记录到${today.painArea || '关节'}不适。刺痛或锐痛时停止相关动作，今天不要勉强完成计划。`,
    }
  }
  if (today && yesterday && today.sleepHours < 6 && yesterday.sleepHours < 6) {
    return {
      level: 'rest',
      title: '连续两晚睡眠不足',
      message: '今天改为休息或轻度活动，不做正式力量训练。睡眠优先。',
    }
  }
  if (today && today.sleepHours < 6) {
    return {
      level: 'reduce',
      title: '今天自动减量',
      message: '昨晚睡眠不足 6 小时，今日每个动作减少 1 组，并保持约 RIR 2。',
    }
  }
  return {
    level: 'normal',
    title: today ? '恢复状态可训练' : '先补充今日恢复状态',
    message: today ? '按计划训练，动作完整、稳定优先于次数。' : '填写昨晚睡眠与疼痛情况后，系统会判断是否需要减量。',
  }
}
