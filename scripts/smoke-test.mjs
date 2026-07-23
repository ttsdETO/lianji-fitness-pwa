import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const executablePath = edgeCandidates.find(existsSync)
if (!executablePath) throw new Error('未找到 Edge 或 Chrome，无法执行浏览器冒烟测试')

const baseURL = process.argv.find((value) => value.startsWith('http://') || value.startsWith('https://')) || process.env.SMOKE_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
const page = await context.newPage()
let nativeDialogCount = 0
page.on('dialog', async (dialog) => {
  nativeDialogCount += 1
  await dialog.dismiss()
})
await page.addInitScript(({ fixedTime }) => {
  const NativeDate = Date
  class FixedDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [fixedTime])) }
    static now() { return NativeDate.now() }
  }
  window.Date = FixedDate
  window.__countdownToneStarts = 0
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (AudioContextClass) {
    const nativeCreateOscillator = AudioContextClass.prototype.createOscillator
    AudioContextClass.prototype.createOscillator = function (...args) {
      const oscillator = nativeCreateOscillator.apply(this, args)
      const nativeStart = oscillator.start.bind(oscillator)
      oscillator.start = (...startArgs) => {
        window.__countdownToneStarts += 1
        return nativeStart(...startArgs)
      }
      return oscillator
    }
  }
}, { fixedTime: new Date('2026-07-21T08:00:00+08:00').getTime() })

const checkHeading = async (name) => {
  const heading = page.locator('h1', { hasText: name })
  await heading.waitFor({ state: 'visible' })
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await checkHeading('下肢 A')
  if (await page.locator('.brand-bar, .local-badge').count()) throw new Error('页面顶部仍显示练迹品牌栏或本机保存标记')
  if (await page.getByText('今日待打卡', { exact: true }).count()) throw new Error('今日页面仍显示今日待打卡区块')
  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
  if (themeColor !== '#f3f0e8') throw new Error(`浅色主题状态栏颜色未与页面背景对齐: ${themeColor}`)
  const bodyBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundImage)
  if (bodyBackground !== 'none') throw new Error(`页面仍在使用会造成状态栏色带的独立渐变: ${bodyBackground}`)
  const pageMotion = await page.locator('.page').evaluate((element) => getComputedStyle(element).animationName)
  if (pageMotion !== 'none') throw new Error(`高频底部导航切页仍有整页入场动画: ${pageMotion}`)
  const primaryTransition = await page.locator('.button.primary').first().evaluate((element) => getComputedStyle(element).transitionProperty)
  if (primaryTransition.split(',').map((value) => value.trim()).includes('all')) throw new Error(`主按钮仍在使用 transition: all: ${primaryTransition}`)
  if (process.env.SMOKE_HOME_SCREENSHOT) {
    await page.waitForTimeout(350)
    await page.screenshot({ path: process.env.SMOKE_HOME_SCREENSHOT, fullPage: false })
  }

  const startBox = await page.getByRole('button', { name: /开始今日训练/ }).boundingBox()
  const navBox = await page.locator('.bottom-nav').boundingBox()
  if (!startBox || !navBox || startBox.y + startBox.height > navBox.y) throw new Error('开始训练按钮仍与底部导航重叠')
  if (navBox.x <= 0 || navBox.width >= 390 || navBox.y + navBox.height >= 844) throw new Error(`底部导航没有形成四周留白的悬浮控件: ${JSON.stringify(navBox)}`)
  const startDockBackground = await page.locator('.start-dock').evaluate((element) => ({ image: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).backgroundColor }))
  if (startDockBackground.image !== 'none' || !startDockBackground.color.includes('0)')) throw new Error('开始训练按钮外层仍有背景色块')
  const recoveryPrompt = page.locator('.today-recovery-prompt')
  await recoveryPrompt.waitFor({ state: 'visible' })
  const recoveryPromptGeometry = await recoveryPrompt.evaluate((element) => {
    const boxes = [...element.children].map((child) => child.getBoundingClientRect())
    const centers = boxes.map((box) => box.y + box.height / 2)
    return {
      display: getComputedStyle(element).display,
      centerSpread: Math.max(...centers) - Math.min(...centers),
      actionHeight: boxes.at(-1)?.height ?? 0,
    }
  })
  if (recoveryPromptGeometry.display !== 'grid' || recoveryPromptGeometry.centerSpread > 1 || recoveryPromptGeometry.actionHeight < 34) {
    throw new Error(`恢复状态填写提示栏排列不整齐: ${JSON.stringify(recoveryPromptGeometry)}`)
  }

  const makeupOptions = page.locator('.makeup-options')
  if (await makeupOptions.getAttribute('open') !== null) throw new Error('补练选项没有默认收起')
  const makeupTapHighlight = await makeupOptions.locator('summary').evaluate((element) => getComputedStyle(element).webkitTapHighlightColor)
  if (makeupTapHighlight !== 'rgba(0, 0, 0, 0)') throw new Error(`补练下拉控件仍有系统触摸高亮: ${makeupTapHighlight}`)
  await makeupOptions.locator('summary').click()
  const makeupRowBox = await makeupOptions.locator('.makeup-option-row').first().boundingBox()
  const makeupButton = makeupOptions.getByRole('button', { name: /开始补练/ })
  const makeupButtonBox = await makeupButton.boundingBox()
  if (!makeupRowBox || !makeupButtonBox || makeupButtonBox.width >= makeupRowBox.width * .45) throw new Error('开始补练按钮的点击范围仍覆盖大块列表区域')
  const makeupShadow = await makeupButton.evaluate((element) => getComputedStyle(element).boxShadow)
  if (makeupShadow !== 'none') throw new Error(`开始补练按钮仍有异常阴影: ${makeupShadow}`)
  if (process.env.SMOKE_MAKEUP_SCREENSHOT) {
    await makeupOptions.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_MAKEUP_SCREENSHOT, fullPage: false })
  }
  await makeupButton.click()
  await page.getByRole('heading', { name: '补练 · 上肢 A' }).waitFor({ state: 'visible' })
  const makeupPhaseTabs = page.locator('.session-phase-tabs')
  if (await makeupPhaseTabs.getByRole('tab').count() !== 3) throw new Error('补练没有显示热身、正式训练和拉伸三个选项卡')
  if ((await makeupPhaseTabs.getByRole('tab', { name: /^热身/ }).getAttribute('aria-selected')) !== 'true') throw new Error('新开始补练时没有先显示热身选项卡')
  if (await page.locator('.session-guide-active.warmup .exercise-card').count() !== 6) throw new Error('补练热身没有使用正式训练同款动作卡展示六项内容')
  if (await page.locator('.session-guide-active.warmup .section-heading, .session-guide-active.warmup .session-guide-intro').count()) throw new Error('开始训练后的热身仍显示重复的大标题或说明')
  if (process.env.SMOKE_ACTIVE_GUIDE_SCREENSHOT) {
    await makeupPhaseTabs.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_ACTIVE_GUIDE_SCREENSHOT, fullPage: false })
  }
  await makeupPhaseTabs.getByRole('tab', { name: /^拉伸/ }).click()
  await page.getByText('头顶肱三头肌拉伸').waitFor({ state: 'visible' })
  if (await page.locator('.session-guide-active.stretch .exercise-card').count() === 0) throw new Error('补练拉伸没有使用正式训练同款动作卡')
  if (process.env.SMOKE_ACTIVE_STRETCH_SCREENSHOT) {
    await makeupPhaseTabs.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_ACTIVE_STRETCH_SCREENSHOT, fullPage: false })
  }
  await makeupPhaseTabs.getByRole('tab', { name: /^正式训练/ }).click()
  await page.getByRole('button', { name: '结束并保存训练' }).click()
  const emptyMakeupDialog = page.locator('.confirm-dialog')
  await emptyMakeupDialog.getByRole('heading', { name: '还没有完成任何一组' }).waitFor({ state: 'visible' })
  await emptyMakeupDialog.getByText('保存本次补练', { exact: true }).waitFor({ state: 'visible' })
  await emptyMakeupDialog.getByRole('button', { name: '取消' }).click()
  await page.locator('.set-check').first().click()
  await page.getByRole('button', { name: '结束并保存训练' }).click()
  await checkHeading('下肢 A')
  if (await page.locator('.makeup-options').count()) throw new Error('完成全部补练后“本周补练”入口仍然显示')
  if (await page.getByText('本周补练', { exact: true }).count()) throw new Error('没有未完成训练时仍显示“本周补练”文案')
  await page.locator('.bottom-nav').getByRole('button', { name: '记录', exact: true }).click()
  const latestHistory = page.locator('.history-card').first()
  await latestHistory.waitFor({ state: 'visible' })
  const latestHistoryText = await latestHistory.innerText()
  if (!latestHistoryText.includes('补练 · 上肢 A') || !latestHistoryText.includes('7月21日') || !latestHistoryText.includes('原计划 7月20日')) {
    throw new Error(`补练记录没有按真实完成日期显示在训练历史顶部：${latestHistoryText}`)
  }
  const latestHistorySummary = await latestHistory.locator('.history-summary').innerText()
  if (/\b\d{1,2}:\d{2}\b/.test(latestHistorySummary)) throw new Error(`训练历史卡片仍显示具体完成时间点：${latestHistorySummary}`)
  await page.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click()
  await checkHeading('下肢 A')

  const previewPhaseTabs = page.locator('.session-phase-tabs')
  if (await previewPhaseTabs.getByRole('tab').count() !== 3) throw new Error('今日计划没有显示三个训练阶段选项卡')
  await previewPhaseTabs.getByRole('tab', { name: /^热身/ }).click()
  const warmupPanel = page.locator('.session-guide-panel.warmup')
  await warmupPanel.waitFor({ state: 'visible' })
  if (await warmupPanel.locator('.preview-row').count() !== 6) throw new Error('通用热身没有使用正式训练同款清单行完整展示六项内容')
  if (await warmupPanel.locator('.section-heading .eyebrow').innerText() !== '今日内容' || await warmupPanel.locator('.session-guide-intro').count()) throw new Error('训练前热身标题栏没有与正式训练保持同款简洁结构')
  await warmupPanel.locator('.preview-row').first().click()
  const warmupDrawer = page.locator('.warmup-drawer')
  await warmupDrawer.getByRole('heading', { name: '原地快走或开合步' }).waitFor({ state: 'visible' })
  if (await warmupDrawer.locator('iframe, .tutorial-section').count()) throw new Error('热身详解不应包含视频')
  const drawerTopGeometry = await warmupDrawer.evaluate((element) => {
    const close = element.querySelector('.drawer-close')?.getBoundingClientRect()
    const visual = element.querySelector('.exercise-visual')?.getBoundingClientRect()
    return close && visual ? { closeBottom: close.bottom, visualTop: visual.top } : null
  })
  if (!drawerTopGeometry || drawerTopGeometry.closeBottom > drawerTopGeometry.visualTop + 1) throw new Error(`抽屉关闭按钮仍与内容头图重叠: ${JSON.stringify(drawerTopGeometry)}`)
  const warmupConfirm = warmupDrawer.getByRole('button', { name: '我知道了' })
  await warmupConfirm.scrollIntoViewIfNeeded()
  const warmupConfirmBox = await warmupConfirm.boundingBox()
  if (!warmupConfirmBox || warmupConfirmBox.y + warmupConfirmBox.height > await page.evaluate(() => window.innerHeight)) throw new Error('热身详解无法滚动到确认按钮')
  if (process.env.SMOKE_WARMUP_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_WARMUP_SCREENSHOT, fullPage: false })
  await warmupConfirm.click()

  await previewPhaseTabs.getByRole('tab', { name: /^拉伸/ }).click()
  const lowerStretchPanel = page.locator('.session-guide-panel.stretch')
  if (await lowerStretchPanel.locator('.preview-row').count() !== 6) throw new Error('下肢日没有用正式训练同款清单行展示五项下肢拉伸和一项可选腹部拉伸')
  if (await lowerStretchPanel.locator('.section-heading .eyebrow').innerText() !== '今日内容' || await lowerStretchPanel.locator('.session-guide-intro').count()) throw new Error('训练前拉伸标题栏没有与正式训练保持同款简洁结构')
  if (process.env.SMOKE_PHASES_SCREENSHOT) {
    await previewPhaseTabs.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_PHASES_SCREENSHOT, fullPage: false })
  }
  await lowerStretchPanel.getByText('轻柔俯卧腹部伸展（可选）').click()
  await page.locator('.stretch-drawer').getByRole('heading', { name: '轻柔俯卧腹部伸展' }).waitFor({ state: 'visible' })
  await page.locator('.stretch-drawer').getByRole('button', { name: '我知道了' }).click()
  await previewPhaseTabs.getByRole('tab', { name: /^正式训练/ }).click()
  await page.locator('.preview-row').first().click()
  await page.locator('.exercise-drawer').waitFor({ state: 'visible' })
  await page.waitForTimeout(400)
  if (await page.locator('.exercise-drawer .tutorial-section, .exercise-drawer iframe, .exercise-drawer a[href*="bilibili"]').count()) throw new Error('今日训练动作详情仍包含视频教程或外部视频链接')
  const confirmButton = page.getByRole('button', { name: '我知道了' })
  await confirmButton.waitFor({ state: 'visible' })
  await confirmButton.scrollIntoViewIfNeeded()
  await page.waitForTimeout(100)
  const confirmBox = await confirmButton.boundingBox()
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  if (!confirmBox || confirmBox.y + confirmBox.height > viewportHeight) {
    const drawerBox = await page.locator('.exercise-drawer').boundingBox()
    throw new Error(`动作详情确认按钮无法滚动到可视区域: button=${JSON.stringify(confirmBox)}, drawer=${JSON.stringify(drawerBox)}`)
  }
  const actionBarBackground = await page.locator('.drawer-action-bar').evaluate((element) => ({ image: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).backgroundColor }))
  if (actionBarBackground.image !== 'none' || !actionBarBackground.color.includes('0)')) throw new Error('动作详情按钮外层仍有背景色块')
  if (process.env.SMOKE_DRAWER_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_DRAWER_SCREENSHOT, fullPage: false })
  await confirmButton.click()

  await page.locator('.bottom-nav').getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('heading', { name: '设置' }).waitFor({ state: 'visible' })
  await page.locator('.week-plan-calendar').getByRole('button', { name: /周二/ }).click()
  const activeDayShadow = await page.locator('.week-plan-calendar button.active').evaluate((element) => getComputedStyle(element).boxShadow)
  if (activeDayShadow !== 'none') throw new Error(`训练计划日期仍有异常阴影: ${activeDayShadow}`)
  const planDayDetails = page.locator('.plan-day-details')
  if (await planDayDetails.getAttribute('open') !== null) throw new Error('训练计划自定义选项没有默认收起')
  const planTapHighlight = await planDayDetails.locator(':scope > summary').evaluate((element) => getComputedStyle(element).webkitTapHighlightColor)
  if (planTapHighlight !== 'rgba(0, 0, 0, 0)') throw new Error(`训练计划下拉控件仍有系统触摸高亮: ${planTapHighlight}`)
  if (process.env.SMOKE_PLAN_COLLAPSED_SCREENSHOT) {
    await planDayDetails.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_PLAN_COLLAPSED_SCREENSHOT, fullPage: false })
  }
  await planDayDetails.locator(':scope > summary').click()
  await page.getByLabel('每日训练总名称').fill('下肢自定义')
  await page.getByRole('button', { name: '从动作数据库添加' }).click()
  await page.getByRole('heading', { name: '动作数据库' }).waitFor({ state: 'visible' })
  const databaseSearch = page.getByLabel('搜索动作数据库')
  if (await databaseSearch.evaluate((element) => document.activeElement === element)) throw new Error('进入动作数据库时搜索框仍被自动选中')
  if (await page.locator('.tutorial-available').count() === 0) throw new Error('已有视频教程的动作卡片没有显示教程角标')
  if (process.env.SMOKE_LIBRARY_BADGE_SCREENSHOT) {
    await databaseSearch.fill('双哑铃前蹲')
    await page.locator('.library-card', { hasText: '双哑铃前蹲' }).first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_LIBRARY_BADGE_SCREENSHOT, fullPage: false })
    await databaseSearch.fill('')
  }
  const libraryChromeStyles = await page.locator('.library-search-sticky').evaluate((element) => {
    const style = getComputedStyle(element)
    return { backgroundColor: style.backgroundColor, backdropFilter: style.backdropFilter, webkitBackdropFilter: style.webkitBackdropFilter }
  })
  if (libraryChromeStyles.backdropFilter !== 'none' || (libraryChromeStyles.webkitBackdropFilter && libraryChromeStyles.webkitBackdropFilter !== 'none')) {
    throw new Error(`动作库搜索区仍使用会透出下层按钮的模糊效果: ${JSON.stringify(libraryChromeStyles)}`)
  }
  if (libraryChromeStyles.backgroundColor === 'transparent' || /rgba\([^)]*,\s*0(?:\.\d+)?\)$/.test(libraryChromeStyles.backgroundColor)) {
    throw new Error(`动作库搜索区没有使用不透底的实色背景: ${libraryChromeStyles.backgroundColor}`)
  }
  const filterDetails = page.locator('.library-filter-details')
  if (await filterDetails.getAttribute('open') !== null) throw new Error('动作库详细分类搜索没有默认收起')
  const lowerCorners = await page.locator('.library-search-sticky').evaluate((element) => ({ left: parseFloat(getComputedStyle(element).borderBottomLeftRadius), right: parseFloat(getComputedStyle(element).borderBottomRightRadius) }))
  if (lowerCorners.left < 16 || lowerCorners.right < 16) throw new Error(`详细分类搜索下方分割处没有圆角: ${JSON.stringify(lowerCorners)}`)
  const allCardBox = await page.locator('.library-results .library-card').first().boundingBox()
  if (!allCardBox || allCardBox.x < 12 || allCardBox.x + allCardBox.width > 378 || Math.abs(allCardBox.x - (390 - allCardBox.x - allCardBox.width)) > 1) throw new Error(`全部动作卡片宽度或左右边距异常: ${JSON.stringify(allCardBox)}`)
  await filterDetails.locator(':scope > summary').click()
  const librarySpacing = await page.locator('.library-body-filters button').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return { height: element.getBoundingClientRect().height, fontSize: parseFloat(style.fontSize) }
  })
  if (librarySpacing.height < 38 || librarySpacing.fontSize < 12) throw new Error(`动作库筛选控件仍过于紧凑: ${JSON.stringify(librarySpacing)}`)
  await databaseSearch.fill('核心 徒手')
  if (await page.locator('.library-card').count() === 0) throw new Error('动作数据库多关键词搜索没有返回结果')
  await databaseSearch.fill('前臂平板支撑')
  const plankCard = page.locator('.library-card', { hasText: '前臂平板支撑' }).first()
  const libraryCardSpacing = await plankCard.evaluate((element) => {
    const main = element.querySelector('.library-card-main')
    const action = element.querySelector('.library-card-actions button')
    if (!main || !action) return null
    const mainStyle = getComputedStyle(main)
    return { paddingTop: parseFloat(mainStyle.paddingTop), titleSize: parseFloat(getComputedStyle(element.querySelector('.library-card-heading strong')).fontSize), actionHeight: action.getBoundingClientRect().height }
  })
  if (!libraryCardSpacing || libraryCardSpacing.paddingTop < 16 || libraryCardSpacing.titleSize < 16 || libraryCardSpacing.actionHeight < 42) {
    throw new Error(`动作库卡片的留白或字号仍过于紧凑: ${JSON.stringify(libraryCardSpacing)}`)
  }
  if (process.env.SMOKE_LIBRARY_SCREENSHOT) {
    await page.waitForTimeout(350)
    await page.screenshot({ path: process.env.SMOKE_LIBRARY_SCREENSHOT, fullPage: false })
  }
  await plankCard.getByRole('button', { name: '查看前臂平板支撑详情' }).click()
  await page.getByRole('heading', { name: '前臂平板支撑' }).waitFor({ state: 'visible' })
  await page.getByText('主要肌群').waitFor({ state: 'visible' })
  const tutorialDetails = page.locator('.database-tutorial')
  await tutorialDetails.locator(':scope > summary').click()
  await tutorialDetails.getByLabel('B站视频链接').fill('https://www.bilibili.com/video/BV1eF3tzjEMk/')
  await tutorialDetails.getByRole('button', { name: '解析并保存' }).click()
  const databaseTutorial = tutorialDetails.locator('.tutorial-section')
  await databaseTutorial.waitFor({ state: 'visible' })
  if (await databaseTutorial.locator('a').count()) throw new Error('数据库可选教程仍显示外部视频链接')
  if (await databaseTutorial.locator('iframe').count()) throw new Error('数据库教程在用户点击前就自动加载')
  await databaseTutorial.getByRole('button', { name: /^播放/ }).click()
  const tutorialFrame = databaseTutorial.locator('iframe')
  await tutorialFrame.waitFor({ state: 'visible' })
  if (!(await tutorialFrame.getAttribute('src'))?.startsWith('https://player.bilibili.com/player.html?')) throw new Error('数据库教程没有正确解析 B 站视频')
  if (process.env.SMOKE_LIBRARY_DETAIL_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_LIBRARY_DETAIL_SCREENSHOT, fullPage: false })
  await page.getByRole('button', { name: '返回动作库' }).click()
  await plankCard.getByText('有教程').waitFor({ state: 'visible' })
  await plankCard.getByRole('button', { name: '收藏前臂平板支撑' }).click()
  await plankCard.getByRole('button', { name: '加入', exact: true }).click()
  const customExerciseEditor = page.locator('.plan-exercise-editor', { hasText: '前臂平板支撑' })
  await customExerciseEditor.getByRole('button', { name: /^查看前臂平板支撑动作提示/ }).click()
  await page.locator('.exercise-drawer').getByRole('heading', { name: '前臂平板支撑' }).waitFor({ state: 'visible' })
  await page.locator('.exercise-drawer').getByRole('button', { name: '我知道了' }).click()
  await customExerciseEditor.getByRole('button', { name: /^查看前臂平板支撑进退阶/ }).last().click()
  await page.getByRole('heading', { name: '动作进退阶' }).waitFor({ state: 'visible' })
  await page.getByText('暂未收录进退阶动作').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '返回设置', exact: true }).click()
  if (await page.locator('.exercise-library').count()) throw new Error('退出进退阶页面后又进入了动作数据库')
  const squatEditor = page.locator('.plan-exercise-editor', { hasText: '双哑铃前蹲' }).first()
  await squatEditor.getByRole('button', { name: /^查看双哑铃前蹲进退阶/ }).last().click()
  await page.getByText('高脚杯深蹲').waitFor({ state: 'visible' })
  if (process.env.SMOKE_RELATIONS_SCREENSHOT) {
    await page.waitForTimeout(350)
    await page.screenshot({ path: process.env.SMOKE_RELATIONS_SCREENSHOT, fullPage: false })
  }
  await page.getByRole('button', { name: '换成此动作' }).click()
  await page.locator('.plan-exercise-editor', { hasText: '高脚杯深蹲' }).waitFor({ state: 'visible' })
  if (process.env.SMOKE_PLAN_COMPACT_SCREENSHOT) {
    await customExerciseEditor.scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.SMOKE_PLAN_COMPACT_SCREENSHOT, fullPage: false })
  }
  await customExerciseEditor.locator('.plan-exercise-parameters > summary').click()
  await customExerciseEditor.getByLabel('记录方式').selectOption('秒')
  await customExerciseEditor.getByLabel('每组倒计时').fill('5')
  await customExerciseEditor.getByLabel('组间休息秒').fill('5')
  if (process.env.SMOKE_PLAN_SCREENSHOT) {
    await customExerciseEditor.scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await page.screenshot({ path: process.env.SMOKE_PLAN_SCREENSHOT, fullPage: false })
  }
  await page.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click()
  await page.getByRole('heading', { name: '下肢自定义' }).waitFor({ state: 'visible' })
  await page.getByText('前臂平板支撑').waitFor({ state: 'visible' })

  await page.getByRole('button', { name: /开始今日训练/ }).click()
  const activePhaseTabs = page.locator('.session-phase-tabs')
  if ((await activePhaseTabs.getByRole('tab', { name: /^热身/ }).getAttribute('aria-selected')) !== 'true') throw new Error('新开始今日训练时没有先显示热身选项卡')
  await activePhaseTabs.getByRole('tab', { name: /^正式训练/ }).click()
  await page.locator('.exercise-cue').first().waitFor({ state: 'visible' })
  if (await page.locator('.manual-stopwatch').count()) throw new Error('训练页顶部仍显示手动秒表')
  await page.getByRole('button', { name: '结束并保存训练' }).click()
  const emptyWorkoutDialog = page.locator('.confirm-dialog')
  await emptyWorkoutDialog.getByRole('heading', { name: '还没有完成任何一组' }).waitFor({ state: 'visible' })
  await emptyWorkoutDialog.getByText('保存本次训练', { exact: true }).waitFor({ state: 'visible' })
  await emptyWorkoutDialog.getByRole('button', { name: '取消' }).click()

  await page.locator('.bottom-nav').getByRole('button', { name: '设置', exact: true }).click()
  const activeDraftPlanDetails = page.locator('.plan-day-details')
  await activeDraftPlanDetails.locator(':scope > summary').click()
  await page.getByRole('button', { name: '从动作数据库添加' }).click()
  const recentTrack = page.locator('.recent-exercise-track')
  await recentTrack.waitFor({ state: 'visible' })
  const recentScroll = await recentTrack.evaluate((element) => {
    const before = element.scrollLeft
    element.scrollLeft = 120
    return { before, after: element.scrollLeft, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, touchAction: getComputedStyle(element).touchAction }
  })
  if (recentScroll.scrollWidth <= recentScroll.clientWidth || recentScroll.after <= recentScroll.before || !recentScroll.touchAction.includes('pan-x') || !recentScroll.touchAction.includes('pan-y')) throw new Error(`最近使用没有同时支持横向浏览和纵向页面滑动: ${JSON.stringify(recentScroll)}`)
  const activeDraftSearch = page.getByLabel('搜索动作数据库')
  await activeDraftSearch.fill('靠墙静蹲')
  await page.locator('.library-card', { hasText: '靠墙静蹲' }).first().getByRole('button', { name: '加入', exact: true }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click()
  await page.locator('.exercise-card', { hasText: '靠墙静蹲' }).waitFor({ state: 'visible' })

  const timedExercise = page.locator('.exercise-card', { hasText: '前臂平板支撑' })
  await timedExercise.getByRole('button', { name: '前臂平板支撑第1组开始倒计时' }).click()
  await page.waitForTimeout(5600)
  if (!(await timedExercise.locator('.set-row').first().evaluate((element) => element.classList.contains('completed')))) throw new Error('自定义倒计时结束后没有自动完成该组')
  await page.locator('.rest-timer').waitFor({ state: 'visible' })
  await page.waitForTimeout(5400)
  if (!(await page.locator('.rest-timer').evaluate((element) => element.classList.contains('finished')))) throw new Error('短组间休息倒计时没有正常结束')
  const countdownToneStarts = await page.evaluate(() => window.__countdownToneStarts)
  if (countdownToneStarts < 10) throw new Error(`动作与休息倒计时的提醒音没有完整触发: ${countdownToneStarts}`)
  if (process.env.SMOKE_ACTIVE_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_ACTIVE_SCREENSHOT, fullPage: false })
  await page.locator('.set-check').first().click()
  await page.locator('.rest-timer').waitFor({ state: 'visible' })
  const timerText = await page.locator('.rest-timer').innerText()
  if (!timerText.includes('组间休息')) throw new Error('完成训练组后未启动休息计时器')

  await page.getByRole('button', { name: '不保存退出' }).click()
  const exitDialog = page.locator('.confirm-dialog')
  await exitDialog.getByRole('heading', { name: '不保存并退出？' }).waitFor({ state: 'visible' })
  const exitDialogBox = await exitDialog.boundingBox()
  if (!exitDialogBox || exitDialogBox.x !== 0 || exitDialogBox.width !== 390) throw new Error(`退出训练底部抽屉没有占满手机宽度: ${JSON.stringify(exitDialogBox)}`)
  if (process.env.SMOKE_EXIT_DIALOG_SCREENSHOT) {
    await page.waitForTimeout(350)
    await page.screenshot({ path: process.env.SMOKE_EXIT_DIALOG_SCREENSHOT, fullPage: false })
  }
  await exitDialog.getByRole('button', { name: '不保存并退出' }).click()
  await page.getByRole('button', { name: /开始今日训练/ }).waitFor({ state: 'visible' })

  for (const [nav, heading] of [['记录', '记录'], ['身体', '身体'], ['恢复', '恢复'], ['设置', '设置']]) {
    await page.locator('.bottom-nav').getByRole('button', { name: nav, exact: true }).click()
    await checkHeading(heading)
    if (nav === '恢复') {
      if (await page.locator('.date-input-shell').count()) throw new Error('恢复页面仍允许手动选择记录日期')
      await page.getByText('系统日期').waitFor({ state: 'visible' })
      await page.getByRole('slider', { name: '起床时间' }).press('ArrowLeft')
      await page.getByText('05:55', { exact: true }).waitFor({ state: 'visible' })
      await page.getByText('6 小时 55 分钟', { exact: true }).first().waitFor({ state: 'visible' })
      if (await page.locator('.sleep-clock-scale line').count() !== 96 || await page.locator('.sleep-clock-scale text').count() !== 8) throw new Error('睡眠圆盘没有完整显示15分钟刻度和3小时时标')
      if (await page.locator('.sleep-schedule-help').count() || await page.getByText('自动计算', { exact: true }).count()) throw new Error('睡眠圆盘周围仍有多余的小字说明')
      const sleepPointSize = await page.getByRole('slider', { name: '起床时间' }).evaluate((element) => getComputedStyle(element, '::before').width)
      if (Number.parseFloat(sleepPointSize) > 30) throw new Error(`睡眠圆盘端点仍然过大: ${sleepPointSize}`)
      const sleepPointAlignment = await page.locator('.sleep-schedule-dial').evaluate((dial) => {
        const dialRect = dial.getBoundingClientRect()
        const progress = dial.querySelector('.sleep-schedule-progress')
        if (!progress) return [999]
        const progressRect = progress.getBoundingClientRect()
        const innerInset = Number.parseFloat(getComputedStyle(progress, '::after').top)
        const targetRadius = progressRect.width / 2 - innerInset / 2
        return [...dial.querySelectorAll('.sleep-schedule-handle button')].map((button) => {
          const rect = button.getBoundingClientRect()
          const radius = Math.hypot(rect.x + rect.width / 2 - (dialRect.x + dialRect.width / 2), rect.y + rect.height / 2 - (dialRect.y + dialRect.height / 2))
          return Math.abs(radius - targetRadius)
        })
      })
      if (sleepPointAlignment.some((offset) => offset > 1)) throw new Error(`睡眠圆盘端点没有对齐弧线中线: ${sleepPointAlignment.join(', ')}`)
      const sleepHandleShadows = await page.locator('.sleep-schedule-handle button').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).boxShadow))
      if (sleepHandleShadows.some((shadow) => shadow !== 'none')) throw new Error(`睡眠时间端点仍有异常阴影: ${sleepHandleShadows.join(', ')}`)
      if (process.env.SMOKE_RECOVERY_SCREENSHOT) {
        await page.waitForTimeout(500)
        await page.screenshot({ path: process.env.SMOKE_RECOVERY_SCREENSHOT, fullPage: false })
      }
    }
    if (nav === '身体') {
      if (await page.locator('.date-input-shell').count()) throw new Error('身体页面仍允许手动选择记录日期')
      await page.getByText('系统日期').waitFor({ state: 'visible' })
    }
    if (nav === '设置') {
      const darkButton = page.getByRole('button', { name: '深色', exact: true })
      await darkButton.click()
      const selectedStyle = await darkButton.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color, transform: getComputedStyle(element).transform }))
      if (selectedStyle.background === 'rgba(0, 0, 0, 0)' || selectedStyle.transform === 'none') throw new Error('深色模式选中按钮没有显示悬浮高亮')
      const darkSurface = await page.locator('body').evaluate((element) => ({
        bodyImage: getComputedStyle(element).backgroundImage,
        bodyColor: getComputedStyle(element).backgroundColor,
        rootColor: getComputedStyle(document.documentElement).backgroundColor,
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      }))
      if (
        darkSurface.bodyImage !== 'none'
        || darkSurface.bodyColor !== 'rgb(15, 20, 16)'
        || darkSurface.rootColor !== 'rgb(15, 20, 16)'
        || darkSurface.themeColor !== '#0f1410'
      ) throw new Error(`深色模式的状态栏与页面背景不统一: ${JSON.stringify(darkSurface)}`)
      if (process.env.SMOKE_SETTINGS_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_SETTINGS_SCREENSHOT, fullPage: false })
      await page.getByRole('button', { name: '恢复默认训练参数' }).click()
      const planResetDialog = page.locator('.confirm-dialog')
      await planResetDialog.getByRole('heading', { name: '恢复默认训练计划？' }).waitFor({ state: 'visible' })
      await planResetDialog.getByRole('button', { name: '取消' }).click()
      await page.getByRole('button', { name: '清空本机全部数据' }).click()
      const clearDialog = page.locator('.confirm-dialog')
      await clearDialog.getByRole('heading', { name: '准备清空全部数据？' }).waitFor({ state: 'visible' })
      const clearDialogBox = await clearDialog.boundingBox()
      if (!clearDialogBox || clearDialogBox.x !== 0 || clearDialogBox.width !== 390) throw new Error(`清空数据底部抽屉没有占满手机宽度: ${JSON.stringify(clearDialogBox)}`)
      if (process.env.SMOKE_CLEAR_DIALOG_SCREENSHOT) {
        await page.waitForTimeout(350)
        await page.screenshot({ path: process.env.SMOKE_CLEAR_DIALOG_SCREENSHOT, fullPage: false })
      }
      await clearDialog.getByRole('button', { name: '继续确认' }).click()
      await clearDialog.getByRole('heading', { name: '清空后无法撤销' }).waitFor({ state: 'visible' })
      await clearDialog.getByRole('button', { name: '取消' }).click()
    }
  }

  if (nativeDialogCount !== 0) throw new Error(`浏览器冒烟测试中仍触发了 ${nativeDialogCount} 个原生确认框`)

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  const securityPolicySource = await page.evaluate(async () => {
    const response = await fetch('/', { cache: 'no-store' })
    const csp = response.headers.get('content-security-policy')
    if (csp) {
      return [
        csp,
        `Referrer-Policy: ${response.headers.get('referrer-policy') ?? ''}`,
        `X-Content-Type-Options: ${response.headers.get('x-content-type-options') ?? ''}`,
      ].join('\n')
    }
    return fetch('/_headers').then((headersResponse) => headersResponse.text())
  })
  for (const requiredPolicy of [
    "connect-src 'self' https://dashscope.aliyuncs.com",
    'frame-src https://player.bilibili.com',
    "frame-ancestors 'none'",
    'Referrer-Policy: no-referrer',
    'X-Content-Type-Options: nosniff',
  ]) {
    if (!securityPolicySource.includes(requiredPolicy)) throw new Error(`安全响应头配置缺少：${requiredPolicy}`)
  }
  const missingPrecachedAssets = await page.evaluate(async () => {
    const manifest = await fetch('/vite-manifest.json').then((response) => response.json())
    const expected = new Set(['/vite-manifest.json'])
    Object.values(manifest).forEach((entry) => {
      if (entry.file) expected.add(`/${entry.file}`)
      ;[...(entry.css ?? []), ...(entry.assets ?? [])].forEach((file) => expected.add(`/${file}`))
    })
    const cacheNames = await caches.keys()
    const cachedRequests = (await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()))).flat()
    const cachedPaths = new Set(cachedRequests.map((request) => new URL(request.url).pathname))
    return [...expected].filter((path) => !cachedPaths.has(path))
  })
  if (missingPrecachedAssets.length) throw new Error(`Service Worker 未预缓存全部构建分块：${missingPrecachedAssets.join(', ')}`)
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await checkHeading('下肢自定义')
  await page.locator('.bottom-nav').getByRole('button', { name: '教练', exact: true }).click()
  await checkHeading('AI 教练')
  const screenshot = process.env.SMOKE_SCREENSHOT
  if (screenshot) {
    await page.waitForTimeout(500)
    await page.screenshot({ path: screenshot, fullPage: false })
  }

  const restContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
  await restContext.addInitScript(({ fixedTime }) => {
    const NativeDate = Date
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])) }
      static now() { return NativeDate.now() }
    }
    window.Date = FixedDate
  }, { fixedTime: new Date('2026-07-22T08:00:00+08:00').getTime() })
  const restPage = await restContext.newPage()
  await restPage.goto(baseURL, { waitUntil: 'networkidle' })
  await restPage.getByRole('heading', { name: '恢复也是训练' }).waitFor({ state: 'visible' })
  if (await restPage.getByText('今日待打卡', { exact: true }).count()) throw new Error('休息日仍显示今日待打卡区块')
  await restPage.locator('.bottom-nav').getByRole('button', { name: '恢复', exact: true }).click()
  await restPage.getByRole('button', { name: '保存恢复打卡' }).click()
  await restPage.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click()
  await restPage.getByText('今日恢复状态已保存').waitFor({ state: 'visible' })
  await restPage.locator('.bottom-nav').getByRole('button', { name: '教练', exact: true }).click()
  const coachSleep = restPage.locator('.coach-context-stats .coach-sleep-value')
  if (await coachSleep.innerText() !== '7 小时') throw new Error(`教练最近睡眠没有与恢复页统一格式：${await coachSleep.innerText()}`)
  await restPage.locator('.bottom-nav').getByRole('button', { name: '身体', exact: true }).click()
  await restPage.getByLabel('晨起空腹体重').fill('56.2')
  await restPage.getByRole('button', { name: '保存身体数据' }).click()
  await restPage.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click()
  if (await restPage.getByText('今日待打卡', { exact: true }).count()) throw new Error('保存身体数据后今日待打卡区块重新出现')

  await restPage.evaluate(() => {
    const key = 'lianji-app-data-v1'
    const data = JSON.parse(localStorage.getItem(key))
    data.workouts = [{
      id: '2026-07-21_lower-a',
      date: '2026-07-21',
      planId: 'lower-a',
      planTitle: '下肢 A',
      startedAt: '2026-07-21T10:00:00.000Z',
      completedAt: '2026-07-21T10:48:00.000Z',
      durationMinutes: 48,
      completionRate: 100,
      recoveryAdjustment: 'none',
      note: '',
      exercises: [{
        exerciseId: 'front-squat',
        exerciseName: '双哑铃前蹲',
        targetSets: 1,
        unit: '次',
        skipped: false,
        skipReason: '',
        sets: [{ index: 1, reps: 15, rir: 2, completed: true }],
      }],
    }]
    localStorage.setItem(key, JSON.stringify(data))
  })
  await restPage.reload({ waitUntil: 'networkidle' })
  await restPage.locator('.bottom-nav').getByRole('button', { name: '记录', exact: true }).click()
  await restPage.locator('.history-card').waitFor({ state: 'visible' })
  if (await restPage.locator('.history-details').count()) throw new Error('训练历史详情默认仍为展开状态')
  await restPage.locator('.history-summary').click()
  await restPage.locator('.history-details').waitFor({ state: 'visible' })
  await restContext.close()

  const reducedMotionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' })
  const reducedMotionPage = await reducedMotionContext.newPage()
  await reducedMotionPage.goto(baseURL, { waitUntil: 'networkidle' })
  await reducedMotionPage.locator('.session-phase-tabs').getByRole('tab', { name: /^热身/ }).click()
  await reducedMotionPage.locator('.session-guide-panel.warmup .preview-row').first().click()
  const reducedDrawer = reducedMotionPage.locator('.warmup-drawer')
  await reducedDrawer.waitFor({ state: 'visible' })
  const reducedMotionStyles = await reducedDrawer.evaluate((element) => ({
    animationName: getComputedStyle(element).animationName,
    buttonTransition: getComputedStyle(element.querySelector('.button.primary')).transitionProperty,
  }))
  if (reducedMotionStyles.animationName !== 'none' || reducedMotionStyles.buttonTransition.includes('transform')) {
    throw new Error(`减少动态模式仍有抽屉位移或按钮缩放反馈: ${JSON.stringify(reducedMotionStyles)}`)
  }
  await reducedMotionContext.close()

  console.log('✓ 手机尺寸首页渲染')
  console.log('✓ 顶部品牌栏已移除，状态栏与页面使用统一纯色背景')
  console.log('✓ 开始按钮避开底部导航，动作详情可滚动到底')
  console.log('✓ 今日与补练均有热身、正式训练、拉伸三个选项卡，标题栏和训练前后卡片均与正式训练统一')
  console.log('✓ 六项热身和按训练部位匹配的拉伸均关联动作数据库并可查看详解')
  console.log('✓ 今日动作提示已移除视频，教程仅保留在动作数据库的可选 B 站解析窗口')
  console.log('✓ 动作数据库教程角标可见、进入时不抢焦点，最近使用支持横向与纵向手势')
  console.log('✓ 计划卡片右上角恢复动作提示，卡片下方保留进退阶功能')
  console.log('✓ 动作数据库支持多关键词搜索、详情、收藏并加入七日计划')
  console.log('✓ 数据库倒计时动作可覆盖参数并同步到今日训练')
  console.log('✓ 已开始训练后新增动作会追加到草稿且保留原有组记录')
  console.log('✓ 训练计划自定义区默认收起，本周漏练可选择补练，记录按实际完成日期归档且不显示具体时间点')
  console.log('✓ 所有下拉标题均已关闭 iOS 系统触摸高亮')
  console.log('✓ 顶部手动秒表已移除，每组倒计时结束后自动完成')
  console.log('✓ 动作与组间休息倒计时在最后3秒和结束时播放不同提示音')
  console.log('✓ 睡眠圆盘使用15分钟细刻度、3小时时标和小尺寸双端点')
  console.log('✓ 深色模式的外观选中按钮清晰可见')
  console.log('✓ 退出训练、恢复默认参数和清空数据使用统一的应用内确认弹层')
  console.log('✓ 逐组完成后自动启动休息计时器')
  console.log('✓ 记录、身体、恢复、设置页面可进入')
  console.log('✓ 今日待打卡已移除，恢复填写提示栏对齐，教练睡眠格式与恢复页一致')
  console.log('✓ 高频切页无整页入场动画，减少动态模式保留颜色反馈并移除位移')
  console.log('✓ 训练历史默认收起并可手动展开')
  console.log('✓ Service Worker 激活后模拟断网刷新成功')
} finally {
  await browser.close()
}
