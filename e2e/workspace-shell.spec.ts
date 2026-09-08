import { expect, test } from '@playwright/test'

test.describe('Workspace shell', () => {
  test('桌面端 AI 工作区在布局列中展开和收起', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const historyTitle = `E2E统一会话${Date.now()}：这道题怎么解？`
    await page.goto('/dashboard')
    const created = await page.evaluate(async (title) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: null,
          messages: [
            { id: 'seed', role: 'user', content: title },
            {
              id: 'proposal', role: 'assistant', content: '我为你整理了一份待确认的行动建议。',
              proposal: {
                proposalId: `proposal-${Date.now()}`,
                items: [{ title: 'E2E 提案任务', date: '2027-01-01', duration: 30, subject: '数学一' }],
              },
            },
          ],
        }),
      })
      const data = await response.json()
      return data.chat?.id || null
    }, historyTitle)
    expect(created).toBeTruthy()

    const trigger = page.getByRole('button', { name: 'AI 工作区' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const workspace = page.getByRole('complementary', { name: 'AI 工作区' })
    await expect(workspace).toBeVisible()
    await expect(workspace.getByRole('heading', { name: 'AI 学习伙伴' })).toBeVisible()
    await workspace.getByRole('button', { name: '历史' }).click()
    const history = workspace.getByText(historyTitle)
    await expect(history).toBeVisible()
    await history.click()
    await expect(workspace.getByText('任务提案')).toBeVisible()
    await expect(workspace.getByRole('button', { name: '加入错题本' })).toBeVisible()

    await workspace.getByRole('button', { name: '关闭' }).click()
    await expect(page.locator('aside[aria-label="AI 工作区"]')).toHaveAttribute('aria-hidden', 'true')
  })

  test('手机端 AI 工作区全屏打开且不保留悬浮遮挡', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/chat')

    const workspace = page.getByRole('complementary', { name: 'AI 工作区' })
    await expect(workspace).toBeVisible()
    await expect(workspace).toHaveCSS('position', 'fixed')
    await expect(workspace.getByRole('heading', { name: 'AI 学习伙伴' })).toBeVisible()
  })

  test('工作台偏好会保留侧栏收起与 AI 宽度状态', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '收起侧边栏' }).click()
    await expect(page.getByRole('button', { name: '展开侧边栏' })).toBeVisible()

    await page.getByRole('button', { name: 'AI 工作区' }).click()
    const workspace = page.getByRole('complementary', { name: 'AI 工作区' })
    await workspace.getByRole('button', { name: '加宽' }).click()
    await expect(workspace).toBeVisible()
  })
})
