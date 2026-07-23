import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const executablePath = edgeCandidates.find(existsSync)
if (!executablePath) throw new Error('未找到 Edge 或 Chrome，无法执行 AI 教练冒烟测试')

const baseURL = process.argv.find((value) => value.startsWith('http://') || value.startsWith('https://')) || process.env.SMOKE_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
const page = await context.newPage()
let nativeDialogCount = 0
page.on('pageerror', (error) => console.error(`PAGE ERROR: ${error.stack || error.message}`))
page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') console.error(`BROWSER ${message.type().toUpperCase()}: ${message.text()}`) })
page.on('dialog', async (dialog) => {
  nativeDialogCount += 1
  await dialog.dismiss()
})

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '教练' }).click()
  await page.getByRole('heading', { name: 'AI 教练' }).waitFor()

  const viewportPolicy = await page.locator('meta[name="viewport"]').getAttribute('content')
  if (!viewportPolicy?.includes('maximum-scale=1') || !viewportPolicy.includes('user-scalable=no')) throw new Error(`页面没有全局禁用缩放: ${viewportPolicy}`)
  const globalTouchAction = await page.locator('html').evaluate((element) => getComputedStyle(element).touchAction)
  if (!globalTouchAction.includes('pan-x') || !globalTouchAction.includes('pan-y') || globalTouchAction.includes('pinch-zoom')) throw new Error(`页面仍允许双指缩放: ${globalTouchAction}`)
  const coachInput = page.getByPlaceholder('问训练、恢复、进步或计划…')
  const coachInputFontSize = await coachInput.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  if (coachInputFontSize < 16) throw new Error(`教练输入框字号仍会触发 iOS 聚焦放大: ${coachInputFontSize}px`)
  const scaleBeforeFocus = await page.evaluate(() => window.visualViewport?.scale ?? 1)
  await coachInput.focus()
  await page.waitForTimeout(100)
  const scaleAfterFocus = await page.evaluate(() => window.visualViewport?.scale ?? 1)
  if (Math.abs(scaleAfterFocus - scaleBeforeFocus) > 0.01) throw new Error(`聚焦教练输入框后页面缩放发生变化: ${scaleBeforeFocus} → ${scaleAfterFocus}`)
  await coachInput.blur()
  const manifestOrientation = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json().then((manifest) => manifest.orientation))
  if (manifestOrientation !== 'portrait-primary') throw new Error(`PWA 没有固定为竖屏方向: ${manifestOrientation}`)

  const composerBackground = await page.locator('.coach-composer-wrap').evaluate((element) => {
    const style = getComputedStyle(element)
    return { image: style.backgroundImage, color: style.backgroundColor }
  })
  if (composerBackground.image !== 'none' || !composerBackground.color.includes('0)')) throw new Error(`教练输入区外层仍会遮挡页面背景: ${JSON.stringify(composerBackground)}`)

  const quickTrack = page.locator('.coach-quick-track')
  const quickTrackScroll = await quickTrack.evaluate((element) => {
    const before = element.scrollLeft
    element.scrollLeft = 120
    return { before, after: element.scrollLeft, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, touchAction: getComputedStyle(element).touchAction }
  })
  if (quickTrackScroll.scrollWidth <= quickTrackScroll.clientWidth || !quickTrackScroll.touchAction.includes('pan-x') || !quickTrackScroll.touchAction.includes('pan-y')) {
    throw new Error(`教练快捷提问没有同时支持横向浏览和纵向页面滑动: ${JSON.stringify(quickTrackScroll)}`)
  }

  const planTarget = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lianji-app-data-v1'))
    const day = data.settings.weeklyPlan.find((item) => item.enabled && item.exercises.length)
    return { weekday: day.weekday, exerciseId: day.exercises[0].id, before: day.exercises[0].sets, after: day.exercises[0].sets === 2 ? 3 : 2 }
  })

  const qwenEndpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  let securedApiRequestCount = 0
  await page.route(qwenEndpoint, async (route) => {
    const request = route.request()
    const headers = await request.allHeaders()
    if (request.url() !== qwenEndpoint) throw new Error(`AI 请求离开固定官方端点: ${request.url()}`)
    if (headers.authorization !== 'Bearer sk-local-smoke-test') throw new Error('AI 请求缺少预期的 Bearer 鉴权')
    if (headers.cookie) throw new Error('AI 请求不应携带浏览器 Cookie')
    securedApiRequestCount += 1
    const body = request.postDataJSON()
    if (body.max_tokens === 12) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '连接成功' } }] }) })
      return
    }
    const content = JSON.stringify({
      reply: '最近记录显示训练完成度稳定。为了验证计划联动，我给出一项保守的组数调整。',
      insights: [{ title: '记录已读取', detail: '回答已结合本机训练计划和近期恢复数据。', tone: 'positive' }],
      suggestions: ['再分析一下最近一次训练'],
      planProposal: {
        title: '保守调整训练量',
        rationale: '只调整一项参数，便于观察下一次训练反馈。',
        changes: [{ weekday: planTarget.weekday, exerciseId: planTarget.exerciseId, field: 'sets', value: planTarget.after, reason: '逐步调整并观察恢复' }],
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 350))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1200, completion_tokens: 260, total_tokens: 1460 } }),
    })
  })

  await page.getByRole('textbox', { name: '百炼 API Key', exact: true }).fill('sk-local-smoke-test')
  if (await page.getByRole('textbox', { name: /Base URL/i }).count()) throw new Error('严格模式下仍暴露自定义 Base URL')
  await page.getByRole('button', { name: '保存并测试' }).click()
  await page.getByText('连接成功 · Qwen3.7-Plus 可用').waitFor()
  const credentialStorage = await page.evaluate(() => ({
    local: localStorage.getItem('lianji-qwen-config-v1'),
    session: sessionStorage.getItem('lianji-qwen-api-key-session-v1'),
  }))
  if (credentialStorage.local?.includes('sk-local-smoke-test')) throw new Error('API Key 仍被写入 localStorage')
  if (credentialStorage.session !== 'sk-local-smoke-test') throw new Error('API Key 未写入当前 sessionStorage')
  if (securedApiRequestCount !== 1) throw new Error(`连接测试请求数量异常: ${securedApiRequestCount}`)
  if (await page.getByText(/AI 建议仅作训练参考/).count()) throw new Error('教练输入栏底部仍显示免责小字')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
  await page.getByPlaceholder('问训练、恢复、进步或计划…').fill('检查我当前的训练计划')
  await page.getByRole('button', { name: '发送给 AI 教练' }).click()
  let jumpButtonFlashed = false
  const jumpSamples = []
  for (let index = 0; index < 12; index += 1) {
    const sample = await page.evaluate(() => ({
      button: Boolean(document.querySelector('.coach-jump-bottom')),
      distance: Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight - window.scrollY),
      scrollY: window.scrollY,
      pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      typing: Boolean(document.querySelector('.coach-typing')),
    }))
    jumpSamples.push(sample)
    if (sample.button) jumpButtonFlashed = true
    await page.waitForTimeout(40)
  }
  await page.getByText('保守调整训练量', { exact: true }).waitFor()
  if (securedApiRequestCount !== 2) throw new Error(`AI 对话请求数量异常: ${securedApiRequestCount}`)
  if (jumpButtonFlashed) throw new Error(`AI 回复过程中“回到底部”按钮仍会闪烁: ${JSON.stringify(jumpSamples)}`)
  const replyBottomDistance = await page.evaluate(() => Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight - window.scrollY))
  if (replyBottomDistance > 2) throw new Error(`AI 回复完成后没有跟随到真实页面底部: ${replyBottomDistance}px`)
  const proposalButtons = page.locator('.coach-plan-proposal .coach-plan-actions button')
  if (await proposalButtons.count() !== 2) {
    const mainText = await page.locator('main').innerText()
    throw new Error(`计划提案没有提供“仅本周 / 今后全部”两个选项：${mainText}`)
  }
  await page.getByRole('button', { name: '仅应用到本周' }).click()
  await page.getByText('调整仅应用到本周计划').waitFor()

  const weeklyResult = await page.evaluate(({ weekday, exerciseId, before, after }) => {
    const data = JSON.parse(localStorage.getItem('lianji-app-data-v1'))
    const baseSets = data.settings.weeklyPlan.find((item) => item.weekday === weekday).exercises.find((item) => item.id === exerciseId).sets
    const override = Object.values(data.settings.weeklyPlanOverrides).find((plan) => plan.find((item) => item.weekday === weekday)?.exercises.find((item) => item.id === exerciseId)?.sets === after)
    return { baseSets, hasOverride: Boolean(override), expectedBase: before }
  }, planTarget)
  if (weeklyResult.baseSets !== weeklyResult.expectedBase || !weeklyResult.hasOverride) throw new Error(`仅本周提案写入范围错误：${JSON.stringify(weeklyResult)}`)

  await page.getByRole('button', { name: '撤回本次调整' }).click()
  await page.getByText(/上次调整已撤回/).waitFor()
  const restoredWeekly = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lianji-app-data-v1'))
    return Object.keys(data.settings.weeklyPlanOverrides).length
  })
  if (restoredWeekly !== 0) throw new Error(`仅本周调整撤回后仍残留覆盖计划：${restoredWeekly}`)

  await page.getByRole('button', { name: '应用到今后所有计划' }).click()
  await page.getByText('调整已应用到今后所有计划').waitFor()
  const updatedSets = await page.evaluate(({ weekday, exerciseId }) => {
    const data = JSON.parse(localStorage.getItem('lianji-app-data-v1'))
    return data.settings.weeklyPlan.find((item) => item.weekday === weekday).exercises.find((item) => item.id === exerciseId).sets
  }, planTarget)
  if (updatedSets !== planTarget.after) throw new Error(`永久计划提案未写入：期望 ${planTarget.after}，实际 ${updatedSets}`)
  await page.getByRole('button', { name: '撤回本次调整' }).click()
  await page.getByText(/上次调整已撤回/).waitFor()
  const restoredSets = await page.evaluate(({ weekday, exerciseId }) => {
    const data = JSON.parse(localStorage.getItem('lianji-app-data-v1'))
    return data.settings.weeklyPlan.find((item) => item.weekday === weekday).exercises.find((item) => item.id === exerciseId).sets
  }, planTarget)
  if (restoredSets !== planTarget.before) throw new Error(`永久计划提案撤回失败：期望 ${planTarget.before}，实际 ${restoredSets}`)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`AI 教练页面出现 ${overflow}px 横向溢出`)

  await page.waitForTimeout(150)
  await page.evaluate(() => {
    const previousScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    document.documentElement.style.scrollBehavior = previousScrollBehavior
  })
  const jumpButton = page.getByRole('button', { name: '回到底部' })
  await jumpButton.waitFor({ state: 'visible' })
  await jumpButton.click()
  await page.waitForFunction(() => Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight - window.scrollY) <= 2)
  await jumpButton.waitFor({ state: 'hidden' })

  await page.screenshot({ path: 'dist/coach-preview.png', fullPage: true })

  const clearButton = page.getByRole('button', { name: '清空', exact: true })
  await clearButton.scrollIntoViewIfNeeded()
  await clearButton.click()
  const clearDialog = page.locator('.confirm-dialog')
  await clearDialog.getByRole('heading', { name: '清空全部对话？' }).waitFor({ state: 'visible' })
  await clearDialog.getByRole('button', { name: '取消' }).click()
  await clearButton.click()
  await clearDialog.getByRole('button', { name: '清空对话' }).click()
  await page.getByText('第一次见面').waitFor({ state: 'visible' })
  if (nativeDialogCount !== 0) throw new Error(`教练页面仍触发了 ${nativeDialogCount} 个浏览器原生确认框`)

  const landscapeContext = await browser.newContext({ viewport: { width: 844, height: 390 }, colorScheme: 'light', isMobile: true, hasTouch: true })
  try {
    const landscapePage = await landscapeContext.newPage()
    await landscapePage.goto(baseURL, { waitUntil: 'networkidle' })
    const landscapeGuard = landscapePage.locator('#portrait-guard')
    await landscapeGuard.getByText('请将手机转回竖屏').waitFor({ state: 'visible' })
    const landscapeState = await landscapePage.evaluate(() => ({
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      guardDisplay: getComputedStyle(document.querySelector('#portrait-guard')).display,
      appVisibility: getComputedStyle(document.querySelector('#root')).visibility,
    }))
    if (!landscapeState.coarsePointer || landscapeState.guardDisplay === 'none' || landscapeState.appVisibility !== 'hidden') throw new Error(`手机横屏保护页没有生效: ${JSON.stringify(landscapeState)}`)
  } finally {
    await landscapeContext.close()
  }

  console.log('✓ AI Key 会话存储、固定官方端点、结构化回复、本周/永久计划提案与撤回均通过')
  console.log('✓ 手机端全局禁用缩放，教练输入框聚焦不放大')
  console.log('✓ PWA 固定竖屏，手机横屏时显示竖屏保护页')
  console.log('✓ 输入区透明且无免责小字，快捷区双向手势、稳定跟随到底部和自定义清空弹窗均通过')
  console.log('✓ 390 × 844 手机视口无横向溢出，未触发浏览器原生弹窗')
} finally {
  await browser.close()
}
