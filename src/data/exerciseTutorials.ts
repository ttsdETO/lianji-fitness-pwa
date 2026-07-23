import type { ExerciseTutorial } from '../types'

const bilibili = (videoId: string, title: string, creator?: string): ExerciseTutorial => ({
  platform: 'bilibili',
  videoId,
  title,
  creator,
  url: `https://www.bilibili.com/video/${videoId}/`,
})

export const defaultExerciseTutorials: Record<string, ExerciseTutorial> = {
  'strict-pull-up': bilibili('BV1sT4y1J7TU', '五个步骤学会引体向上：动作与常见错误', '小波健身'),
  'incline-push-up': bilibili('BV1ua411z7Eu', '上斜俯卧撑动作教学', 'luoluo1216'),
  'single-arm-dumbbell-row': bilibili('BV1Vh411775b', '单臂哑铃划船：正确做法', 'Gandy__'),
  'dumbbell-floor-press': bilibili('BV12g411G76t', '哑铃地板卧推：自由重量入门'),
  'dumbbell-lateral-raise': bilibili('BV18o4y147RH', '哑铃侧平举：正确做法', 'Gandy__'),
  'reverse-crunch': bilibili('BV1hb4y1a7Rd', '反向卷腹：常见错误与正确发力', 'Mina筱敏'),
  'dumbbell-front-squat': bilibili('BV1X2421P7TL', '哑铃深蹲详解', '凯圣王'),
  'romanian-deadlift': bilibili('BV1Zt421g7p5', '罗马尼亚硬拉详解', '凯圣王'),
  'split-squat': bilibili('BV1fs4y1k7BP', '分腿蹲教学：重心、稳定与膝盖位置', '别想变胖'),
  'standing-calf-raise': bilibili('BV1Vs421M7gV', '站姿提踵动作解析', '跟练健身Online'),
  'dead-bug': bilibili('BV1Bu411V7rW', '标准死虫式：康复师跟练演示', '运动康复陈老师'),
  'side-plank': bilibili('BV1eF3tzjEMk', '侧平板支撑保姆级教学', 'ACE宋健鹏'),
  'pike-push-up': bilibili('BV17b42187Wj', '派克俯卧撑动作解析', '跟练健身Online'),
  'eccentric-push-up': bilibili('av370085991', '标准俯卧撑进阶与离心训练', 'JunJ徒手俊杰'),
  'hammer-curl': bilibili('BV1iJ411U72E', '锤式弯举：动作示范与常见错误', '蔡梓强'),
  'overhead-triceps-extension': bilibili('BV1BE411C7Cm', '哑铃颈后臂屈伸细节讲解', '撸铁孔先森'),
  'hanging-knee-raise': bilibili('BV1Ma4y1P7Ug', '屈膝悬垂举腿动作教学', '徐微小'),
  'goblet-squat': bilibili('BV1TT4y1p7YR', '高脚杯深蹲详解', '凯圣王'),
  'single-leg-romanian-deadlift': bilibili('BV1Q5411H7vW', '如何做单腿罗马尼亚硬拉', '戴夫健身'),
  'weighted-glute-bridge': bilibili('BV1gg411Z7nN', '居家哑铃臀桥动作教学', '姚晓龙Mike'),
  'single-leg-calf-raise': bilibili('BV1Cf4y1S7gP', '哑铃单脚提踵动作教学', '上海体适能afcc'),
  'dumbbell-crunch': bilibili('BV1Tk4y1U75b', '哑铃仰卧卷腹动作教学', '未来健身科技'),
  'bird-dog': bilibili('BV1ne411W7MV', '鸟狗式完整教程', '爽总是熬夜'),
  'vertical-jump': bilibili('BV1WfUBBTEyo', '原地纵跳动作示范', '东叔说运动训练'),
}

export const cloneDefaultExerciseTutorials = () => Object.fromEntries(
  Object.entries(defaultExerciseTutorials).map(([exerciseId, tutorial]) => [exerciseId, { ...tutorial }]),
)

export const parseBilibiliVideoId = (value: string) => {
  const match = value.trim().match(/(?:video\/|bvid=)?(BV[0-9A-Za-z]{10}|av\d+)/i)
  if (!match) return undefined
  return match[1].toLowerCase().startsWith('av') ? `av${match[1].slice(2)}` : `BV${match[1].slice(2)}`
}

export const createBilibiliTutorial = (value: string, exerciseName: string, previous?: ExerciseTutorial | null): ExerciseTutorial | undefined => {
  const videoId = parseBilibiliVideoId(value)
  if (!videoId) return undefined
  return {
    platform: 'bilibili',
    videoId,
    title: previous?.videoId === videoId ? previous.title : `${exerciseName}动作教程`,
    creator: previous?.videoId === videoId ? previous.creator : undefined,
    url: `https://www.bilibili.com/video/${videoId}/`,
  }
}
