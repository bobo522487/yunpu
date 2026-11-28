import { describe, expect, it } from 'vitest'
import { sidebarData } from './sidebar-data'

describe('组织空间全局侧栏', () => {
  it('只保留组织空间一个导航分组', () => {
    expect(sidebarData.navGroups.map((group) => group.title)).toEqual([
      '组织空间',
    ])
  })

  it('组织空间导航项为家族、成员与组织设置', () => {
    expect(
      sidebarData.navGroups[0].items.map(({ title, url }) => ({ title, url }))
    ).toEqual([
      { title: '家族', url: '/projects' },
      { title: '成员', url: '/members' },
      { title: '组织设置', url: '/settings' },
    ])
    expect(sidebarData.navGroups[0].items.map((item) => item.title)).not.toContain(
      '工作台'
    )
  })
})
