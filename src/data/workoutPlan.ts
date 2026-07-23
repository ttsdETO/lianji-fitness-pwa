import type { Exercise, TrainingDay, WarmupExercise } from '../types'
import { findDatabaseExercise } from './exerciseDatabase'

export const warmup: WarmupExercise[] = [
  {
    id: 'march-or-step', databaseExerciseId: 'jumping-jack', phase: 'warmup', name: '原地快走或开合步', dose: '1 分钟', purpose: '升高体温，平稳进入训练状态',
    steps: ['站直并轻收核心，先用原地快走开始。', '自然摆臂，逐渐提高抬腿与摆臂速度。', '身体感觉舒展后，可改为低冲击开合步直到 1 分钟。'],
    tips: ['保持可以正常说短句的强度', '脚掌轻柔落地，膝盖朝脚尖方向'],
    mistakes: ['一开始就全速跳跃', '落地很重或膝盖向内扣'],
  },
  {
    id: 'shoulder-circles', databaseExerciseId: 'shoulder-circles', phase: 'warmup', name: '肩部前后绕环', dose: '前后各 10 次', purpose: '活动肩关节，为上肢推拉做准备',
    steps: ['站稳，手臂自然伸向身体两侧。', '从小圈开始向前绕肩，逐渐增大到舒适范围。', '完成 10 次后换方向，再向后绕 10 次。'],
    tips: ['动作慢而连续，不必追求最大幅度', '保持肋骨收拢，颈部放松'],
    mistakes: ['耸肩并让颈部持续紧张', '为了画大圈而甩动腰部'],
  },
  {
    id: 'scapular-push-up', databaseExerciseId: 'scapular-push-up', phase: 'warmup', name: '肩胛俯卧撑', dose: '8 次', purpose: '唤醒肩胛控制，稳定肩部',
    steps: ['双手撑地或较高台面，身体保持一条直线。', '手肘始终伸直，让胸口缓慢向双手之间下沉。', '再主动把地面推远，使上背部轻微拱起，完成一次。'],
    tips: ['只移动肩胛骨，不做普通俯卧撑', '力量不足时在桌沿或墙面完成'],
    mistakes: ['屈肘代替肩胛移动', '塌腰、抬头或动作过快'],
  },
  {
    id: 'bodyweight-hip-hinge', databaseExerciseId: 'hip-hinge-drill', phase: 'warmup', name: '徒手髋铰链', dose: '10 次', purpose: '练习屈髋，为硬拉和下肢动作预热',
    steps: ['双脚约与髋同宽，膝盖保持轻微弯曲。', '臀部向后推，躯干随之向前倾，背部保持自然。', '感到大腿后侧轻微拉伸后，夹臀站回直立。'],
    tips: ['想象用臀部向后关门', '重心均匀留在整个脚掌'],
    mistakes: ['膝盖大幅前移，把动作做成深蹲', '弓背低头或站起时腰部后仰'],
  },
  {
    id: 'bodyweight-half-squat', databaseExerciseId: 'bodyweight-squat', phase: 'warmup', name: '徒手半蹲', dose: '10 次', purpose: '活动髋膝踝，唤醒腿部发力',
    steps: ['双脚采用自然站距，脚掌三点稳定踩地。', '臀部向后下方移动，膝盖顺着脚尖方向弯曲。', '下蹲到轻松可控的半程，再平稳站起。'],
    tips: ['热身只需舒适半程，不用追求蹲深', '全程保持脚跟和前脚掌接触地面'],
    mistakes: ['膝盖向内塌或脚跟抬起', '快速下坠后依靠反弹站起'],
  },
  {
    id: 'first-exercise-ramp-set', databaseExerciseId: 'first-exercise-ramp-set', phase: 'warmup', name: '第一个动作轻量热身组', dose: '1 组', purpose: '用低难度预演当天的第一个正式动作',
    steps: ['选择比正式组更轻的重量或更容易的动作变式。', '完成约 5–10 次流畅重复，逐步找准动作轨迹。', '结束时应感觉更熟练而不是疲劳，稍作休息再开始正式组。'],
    tips: ['引体向上可先做肩胛下沉或 2–3 次轻松重复', '深蹲、硬拉等使用正式重量的一小部分即可'],
    mistakes: ['把热身组做到力竭', '跳过动作检查，直接使用正式强度'],
  },
]

const stretchFromDatabase = (id: string, optional = false): WarmupExercise => {
  const exercise = findDatabaseExercise(id)
  if (!exercise) throw new Error(`拉伸未关联动作数据库：${id}`)
  return {
    id: `stretch-${exercise.id}`,
    databaseExerciseId: exercise.id,
    phase: 'stretch',
    optional,
    name: exercise.name,
    dose: exercise.defaultPrescription.reps,
    purpose: exercise.effects[0] ?? '训练后温和放松并维持活动度',
    steps: exercise.steps,
    tips: exercise.cues,
    mistakes: exercise.commonMistakes,
  }
}

export const upperBodyStretching: WarmupExercise[] = [
  stretchFromDatabase('doorway-chest-stretch'),
  stretchFromDatabase('wall-lat-stretch'),
  stretchFromDatabase('cross-body-shoulder-stretch'),
  stretchFromDatabase('overhead-triceps-stretch'),
]

export const lowerBodyStretching: WarmupExercise[] = [
  stretchFromDatabase('standing-quad-stretch'),
  stretchFromDatabase('supine-hamstring-stretch'),
  stretchFromDatabase('figure-four-stretch'),
  stretchFromDatabase('standing-hip-flexor-stretch'),
  stretchFromDatabase('wall-calf-stretch'),
]

export const abdominalStretching: WarmupExercise = stretchFromDatabase('prone-abdominal-stretch', true)

export const getPostWorkoutStretching = (exercises: Exercise[]): WarmupExercise[] => {
  const categories = new Set(exercises.map((exercise) => exercise.databaseCategory ?? exercise.category))
  const hasUpperBody = ['上肢推', '上肢拉', '手臂'].some((category) => categories.has(category))
  const hasLowerBody = categories.has('下肢')
  const hasCore = categories.has('核心')
  const selected = [
    ...(hasUpperBody ? upperBodyStretching : []),
    ...(hasLowerBody ? lowerBodyStretching : []),
    ...(hasCore ? [abdominalStretching] : []),
  ]
  return selected.length ? selected : [...upperBodyStretching, ...lowerBodyStretching]
}

const painWarning = '出现关节刺痛、锐痛或明显不适时立即停止；肌肉酸胀可以接受。'

const exercise = (value: Exercise): Exercise => value

export const trainingPlan: TrainingDay[] = [
  {
    id: 'upper-a', weekday: 1, title: '上肢 A', focus: '肩背宽度 · 胸部 · 腹肌', duration: '45–65 分钟',
    exercises: [
      exercise({ id: 'strict-pull-up-a', name: '严格引体向上', category: '复合', equipment: '单杠', sets: 3, repsMin: 4, repsMax: 5, unit: '次', restSeconds: 150, tempo: '下降约 2 秒', steps: ['从主动悬垂开始，肩胛稳定。', '不摆腿地拉起，直到下巴明确越过单杠。', '控制下降约 2 秒，回到完整伸展。'], tips: ['在目标区间内保留约 2 次余力', '全程不摆腿、不蹬腿', '无法稳定完成时改用弹力带或离心版本'], mistakes: ['只做半程', '耸肩起拉', '用摆动借力'], painWarning }),
      exercise({ id: 'incline-push-up', name: '斜板俯卧撑', category: '复合', equipment: '牢固桌沿 / 固定台面', sets: 3, repsMin: 8, repsMax: 12, unit: '次', restSeconds: 120, steps: ['双手撑稳，身体从头到脚保持一条直线。', '胸口下降到接近支撑面。', '推回起点，保持核心收紧。'], tips: ['手肘与身体约呈 30–45°', '达到 12、12、12 后降低支撑高度'], mistakes: ['塌腰或撅臀', '下降深度不足', '肘部完全横向张开'], painWarning }),
      exercise({ id: 'one-arm-row-a', name: '单臂哑铃划船', category: '复合', equipment: '可调重量哑铃', weight: '自选', sets: 3, repsMin: 12, repsMax: 20, unit: '次', perSide: true, restSeconds: 120, tempo: '顶端停 1 秒，下降 2–3 秒', steps: ['一手支撑稳定，躯干保持不动。', '肘部向髋部方向拉。', '顶端停 1 秒后缓慢下降。'], tips: ['左右做相同次数', '让背部发力，不只用手臂'], mistakes: ['躯干明显旋转', '耸肩', '快速下放'], painWarning }),
      exercise({ id: 'floor-press', name: '哑铃地板卧推', category: '复合', equipment: '一对可调重量哑铃', weight: '自选', sets: 3, repsMin: 12, repsMax: 20, unit: '次', restSeconds: 120, steps: ['仰卧屈膝，哑铃位于胸部两侧。', '上臂轻触地面后稳定推起。', '保持肩胛稳定，控制回落。'], tips: ['肘部不要完全横向张开', '肩膀远离耳朵'], mistakes: ['哑铃相撞', '耸肩推起', '腰部过度拱起'], painWarning }),
      exercise({ id: 'lateral-raise', name: '哑铃侧平举', category: '辅助', equipment: '一对轻哑铃', weight: '自选', sets: 2, repsMin: 8, repsMax: 15, unit: '次', restSeconds: 75, steps: ['站稳并微屈手肘。', '向身体斜前方平稳抬起。', '在可控范围内缓慢放下。'], tips: ['不耸肩、不甩腰', '太重时可减小幅度或换轻物'], mistakes: ['身体摆动', '手腕高于手肘过多', '耸肩'], painWarning }),
      exercise({ id: 'reverse-crunch', name: '反向卷腹', category: '核心', equipment: '瑜伽垫', sets: 3, repsMin: 10, repsMax: 15, unit: '次', restSeconds: 75, steps: ['仰卧，髋膝约 90°，腰部轻贴地。', '用腹肌把骨盆卷向胸口。', '尾骨离地少量后控制回落。'], tips: ['幅度小而扎实', '保持呼吸'], mistakes: ['用腿摆动借力', '腰部拱起', '追求过大幅度'], painWarning }),
    ],
  },
  {
    id: 'lower-a', weekday: 2, title: '下肢 A', focus: '股四头肌 · 后链 · 单侧稳定', duration: '45–60 分钟',
    exercises: [
      exercise({ id: 'front-squat', name: '双哑铃前蹲', category: '复合', equipment: '一对可调重量哑铃', weight: '自选', sets: 3, repsMin: 12, repsMax: 20, unit: '次', restSeconds: 150, steps: ['哑铃稳定放在肩前。', '脚跟踩地，膝盖沿脚尖方向移动。', '蹲到稳定无痛的深度后站起。'], tips: ['躯干保持稳定', '动作完整优先于次数'], mistakes: ['脚跟离地', '膝盖内扣', '塌腰抢起'], painWarning }),
      exercise({ id: 'romanian-deadlift', name: '双哑铃罗马尼亚硬拉', category: '复合', equipment: '一对可调重量哑铃', weight: '自选', sets: 3, repsMin: 12, repsMax: 20, unit: '次', restSeconds: 150, steps: ['膝盖微屈，臀部向后推。', '哑铃贴近腿部下降。', '感到大腿后侧拉伸后夹臀站起。'], tips: ['脊柱保持自然', '站起时腰部不过度后仰'], mistakes: ['变成深蹲', '哑铃远离身体', '弓背'], painWarning }),
      exercise({ id: 'split-squat-a', name: '扶墙分腿蹲', category: '复合', equipment: '徒手 / 墙面', sets: 2, repsMin: 8, repsMax: 12, unit: '次', perSide: true, restSeconds: 120, steps: ['分腿站立，一手轻扶墙。', '身体垂直下降到无痛深度。', '主要由前腿发力站起。'], tips: ['左右做相同次数', '先徒手建立稳定性'], mistakes: ['前膝内扣', '后脚发力过多', '身体前后晃动'], painWarning: '出现膝关节不适时停止本动作，不要硬撑。' }),
      exercise({ id: 'calf-raise-a', name: '双脚提踵', category: '辅助', equipment: '双手持哑铃', weight: '可负重', sets: 3, repsMin: 15, repsMax: 25, unit: '次', restSeconds: 75, tempo: '顶端停 1 秒，下降 2 秒', steps: ['双脚站稳，脚掌均匀受力。', '抬起脚跟并在顶端停 1 秒。', '控制下降约 2 秒。'], tips: ['完整踝关节幅度', '必要时轻扶固定物'], mistakes: ['快速弹跳', '脚踝向外翻', '下放失控'], painWarning }),
      exercise({ id: 'dead-bug', name: '死虫式', category: '核心', equipment: '瑜伽垫', sets: 2, repsMin: 8, repsMax: 12, unit: '次', perSide: true, restSeconds: 75, steps: ['仰卧抬起手臂与双腿，腰部轻贴地。', '对侧手脚缓慢伸出。', '保持腰背稳定后回到起点。'], tips: ['腰一旦拱起就缩小幅度', '慢而稳'], mistakes: ['屏住呼吸', '腰部离地', '动作过快'], painWarning }),
      exercise({ id: 'side-plank', name: '侧平板支撑', category: '核心', equipment: '瑜伽垫', sets: 2, repsMin: 20, repsMax: 35, unit: '秒', perSide: true, restSeconds: 75, steps: ['肘部置于肩膀正下方。', '抬起髋部，让身体成一条直线。', '保持稳定呼吸。'], tips: ['左右时间一致', '头颈保持自然'], mistakes: ['髋部下沉', '肩膀挤向耳朵', '身体向前旋转'], painWarning }),
    ],
  },
  {
    id: 'upper-b', weekday: 4, title: '上肢 B', focus: '肩部推力 · 背部 · 手臂 · 腹肌', duration: '50–65 分钟',
    exercises: [
      exercise({ id: 'strict-pull-up-b', name: '严格引体向上', category: '复合', equipment: '单杠', sets: 3, repsMin: 3, repsMax: 5, unit: '次', restSeconds: 150, steps: ['主动悬垂，肩胛保持稳定。', '保持正握并拉到下巴越杠。', '控制下降到完整幅度。'], tips: ['不追求极限次数', '全程保留约 2 次余力'], mistakes: ['摆腿借力', '半程动作', '下落过快'], painWarning }),
      exercise({ id: 'pike-push-up', name: '屈体俯卧撑', category: '复合', equipment: '瑜伽垫', sets: 3, repsMin: 6, repsMax: 10, unit: '次', restSeconds: 120, steps: ['双手撑地，身体呈倒 V 形。', '头部向双手前方下降。', '肩部发力推回。'], tips: ['重点感受肩部推力', '保持核心稳定'], mistakes: ['头垂直砸向地面', '手肘过度外张', '动作幅度失控'], painWarning: '肩关节出现夹痛时立即改为斜板俯卧撑。' }),
      exercise({ id: 'eccentric-push-up', name: '离心标准俯卧撑', category: '复合', equipment: '瑜伽垫', sets: 3, repsMin: 5, repsMax: 5, unit: '次', restSeconds: 120, tempo: '下降约 4 秒', steps: ['从标准俯卧撑顶端开始。', '用约 4 秒下降到胸口接近地面。', '膝盖落地，用跪姿回顶，再重新伸直双腿。'], tips: ['每次都从标准顶端开始', '优先保证深度'], mistakes: ['下降过快', '塌腰', '未到接近地面的深度'], painWarning }),
      exercise({ id: 'one-arm-row-b', name: '单臂哑铃划船', category: '复合', equipment: '可调重量哑铃', weight: '自选', sets: 3, repsMin: 15, repsMax: 20, unit: '次', perSide: true, restSeconds: 120, tempo: '顶端收紧，下降约 3 秒', steps: ['稳定支撑，躯干不旋转。', '肘部向髋部方向拉。', '顶端收紧后缓慢下降。'], tips: ['左右次数相同', '下降可放慢到 3 秒'], mistakes: ['耸肩', '躯干旋转', '手臂甩动'], painWarning }),
      exercise({ id: 'hammer-curl', name: '锤式弯举', category: '辅助', equipment: '一对可调重量哑铃', weight: '自选', sets: 2, repsMin: 10, repsMax: 20, unit: '次', restSeconds: 75, steps: ['站稳，掌心相对。', '肘部靠近身体完成弯举。', '控制下降到手臂伸展。'], tips: ['选择全程可控的重量', '手腕保持中立'], mistakes: ['身体后仰', '甩动哑铃', '肘部向前跑'], painWarning }),
      exercise({ id: 'overhead-triceps', name: '单哑铃颈后臂屈伸', category: '辅助', equipment: '可调重量哑铃', weight: '自选', sets: 2, repsMin: 10, repsMax: 20, unit: '次', restSeconds: 75, steps: ['双手托稳哑铃并举过头顶。', '屈肘让哑铃在头后下降。', '伸肘回到起点。'], tips: ['肘部尽量朝前', '腹部收紧，不塌腰'], mistakes: ['肘部大幅外翻', '腰部过度后仰', '下降失控'], painWarning }),
      exercise({ id: 'hanging-knee-raise', name: '悬垂屈膝举腿', category: '核心', equipment: '单杠', sets: 3, repsMin: 6, repsMax: 12, unit: '次', restSeconds: 75, tempo: '下降 2–3 秒', steps: ['保持轻微主动悬垂。', '膝盖向胸口抬，顶端轻卷骨盆。', '控制下降，避免摆动。'], tips: ['身体明显摆动时结束该组', '幅度服从控制'], mistakes: ['甩腿借力', '完全放松肩膀', '只屈髋不卷骨盆'], painWarning }),
    ],
  },
  {
    id: 'lower-b', weekday: 6, title: '下肢 B', focus: '臀腿 · 单侧稳定 · 腹肌', duration: '50–65 分钟',
    exercises: [
      exercise({ id: 'goblet-squat', name: '慢速高脚杯深蹲', category: '复合', equipment: '可调重量哑铃', weight: '自选', sets: 3, repsMin: 15, repsMax: 20, unit: '次', restSeconds: 150, tempo: '下降 3 秒，底部停 1 秒', steps: ['哑铃置于胸前，双脚稳定。', '用 3 秒下降，底部停 1 秒。', '保持稳定站起。'], tips: ['脚掌三点均匀受力', '深度以稳定无痛为准'], mistakes: ['膝盖内扣', '底部放松', '抢速站起'], painWarning }),
      exercise({ id: 'single-leg-rdl', name: '单腿罗马尼亚硬拉', category: '复合', equipment: '轻哑铃 / 墙面', weight: '自选', sets: 3, repsMin: 8, repsMax: 12, unit: '次', perSide: true, restSeconds: 120, steps: ['支撑腿膝盖微屈，可空手扶墙。', '臀部后移，另一腿向后延伸。', '保持骨盆朝下并稳定站起。'], tips: ['先保证平衡再增加重量', '左右次数相同'], mistakes: ['骨盆向侧面翻开', '支撑膝内扣', '弓背'], painWarning }),
      exercise({ id: 'weighted-glute-bridge', name: '负重臀桥', category: '复合', equipment: '可调重量哑铃 + 瑜伽垫', weight: '自选', sets: 3, repsMin: 15, repsMax: 25, unit: '次', restSeconds: 120, tempo: '顶端夹臀停 2 秒', steps: ['仰卧屈膝，把哑铃稳定放在髋部。', '收紧臀部抬起髋部。', '顶端停 2 秒后控制下降。'], tips: ['肋骨保持收拢', '主要感受臀部'], mistakes: ['腰部过度后仰', '膝盖向外或向内晃', '顶端不稳定'], painWarning }),
      exercise({ id: 'split-squat-b', name: '扶墙分腿蹲', category: '复合', equipment: '徒手 / 墙面', sets: 2, repsMin: 8, repsMax: 12, unit: '次', perSide: true, restSeconds: 120, condition: '动作全程稳定且无痛时进行；否则改为舒适范围的徒手深蹲。', steps: ['分腿站立并轻扶墙。', '身体垂直下降。', '以前腿为主站起。'], tips: ['左右次数相同', '膝盖不适就改做徒手深蹲'], mistakes: ['膝盖内扣', '身体晃动', '后腿发力过多'], painWarning: '出现膝部不适时立即停止并选择无痛替代动作。' }),
      exercise({ id: 'single-calf-raise', name: '单腿提踵', category: '辅助', equipment: '墙面，可选哑铃', weight: '徒手或自选', sets: 3, repsMin: 10, repsMax: 20, unit: '次', perSide: true, restSeconds: 75, steps: ['一只手轻扶墙，单脚稳定站立。', '脚跟抬到最高可控位置。', '控制下降到完整幅度。'], tips: ['先徒手，轻松完成后再加重量', '左右次数相同'], mistakes: ['弹跳借力', '脚踝歪斜', '下落过快'], painWarning }),
      exercise({ id: 'dumbbell-crunch', name: '哑铃卷腹', category: '核心', equipment: '轻哑铃 + 瑜伽垫', weight: '自选', sets: 3, repsMin: 12, repsMax: 20, unit: '次', restSeconds: 75, tempo: '顶端停 1–2 秒', steps: ['仰卧屈膝，哑铃稳定放在胸前。', '用腹肌抬起肩胛骨。', '顶端停 1–2 秒后缓慢回落。'], tips: ['不做完整仰卧起坐', '太轻可延长离心或小幅增加重量'], mistakes: ['用头颈发力', '借惯性坐起', '腰部离地过多'], painWarning }),
      exercise({ id: 'bird-dog', name: '鸟狗式', category: '核心', equipment: '瑜伽垫', sets: 2, repsMin: 8, repsMax: 10, unit: '次', perSide: true, restSeconds: 75, steps: ['四点跪姿，核心轻收紧。', '对侧手脚缓慢伸出。', '保持骨盆稳定后回到起点。'], tips: ['想象背上放着一杯水', '动作慢而稳'], mistakes: ['骨盆旋转', '腰部下塌', '抬腿过高'], painWarning }),
    ],
  },
]

export const optionalPerformanceExercise = exercise({
  id: 'vertical-jump', name: '原地纵跳（第 3 周起可选）', category: '性能', equipment: '空地', sets: 3, repsMin: 3, repsMax: 3, unit: '次', restSeconds: 90,
  condition: '具备稳定深蹲与轻柔落地能力，且动作全程无痛时再加入。',
  steps: ['站稳并轻微屈膝蓄力。', '向上快速跳起。', '轻柔落地，每次重新站稳。'],
  tips: ['每次都重置站姿', '以落地质量为先'], mistakes: ['连续弹跳', '落地膝盖内扣', '带痛训练'],
  painWarning: '出现膝部不适立即取消。',
})

export const getPlanForWeekday = (weekday: number) => trainingPlan.find((day) => day.weekday === weekday)

export const findExercise = (exerciseId: string) => {
  for (const day of trainingPlan) {
    const found = day.exercises.find((item) => item.id === exerciseId)
    if (found) return found
  }
  return undefined
}
