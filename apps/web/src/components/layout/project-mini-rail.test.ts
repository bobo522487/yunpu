import { describe, expect, it } from 'vitest'
import { railItems } from './project-mini-rail'

describe('项目内 mini rail 入口（Seam B）', () => {
  it('首项为「概览」且目标是项目首页 /projects/:projectId', () => {
    expect(railItems[0].label).toBe('概览')
    expect(railItems[0].to).toBe('/projects/:projectId')
  })

  it('末项为「家族设置」且目标是 /projects/:projectId/settings', () => {
    const last = railItems[railItems.length - 1]
    expect(last.label).toBe('家族设置')
    expect(last.to).toBe('/projects/:projectId/settings')
  })

  it('入口顺序为概览、谱系、谱文、谱书、家族设置', () => {
    expect(railItems.map((item) => item.label)).toEqual([
      '概览',
      '谱系',
      '谱文',
      '谱书',
      '家族设置',
    ])
  })
})
