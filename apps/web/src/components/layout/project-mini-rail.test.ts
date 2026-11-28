import { describe, expect, it } from 'vitest'
import { railItems } from './project-mini-rail'

describe('项目内图标导航条入口（Seam B）', () => {
  it('首项为「概览」且目标是项目首页 /projects/:projectId', () => {
    expect(railItems[0].label).toBe('概览')
    expect(railItems[0].to).toBe('/projects/:projectId')
  })

  it('末项视觉标签为「设置」、无障碍名称为「家族设置」且目标是 /projects/:projectId/settings', () => {
    const last = railItems[railItems.length - 1]
    expect(last.label).toBe('设置')
    expect(last.accessibleLabel).toBe('家族设置')
    expect(last.to).toBe('/projects/:projectId/settings')
  })

  it('入口顺序为概览、谱系、谱文、谱书、设置且均为两汉字', () => {
    expect(railItems.map((item) => item.label)).toEqual([
      '概览',
      '谱系',
      '谱文',
      '谱书',
      '设置',
    ])
    for (const item of railItems) {
      expect(Array.from(item.label)).toHaveLength(2)
    }
  })
})
