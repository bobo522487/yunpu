import { describe, expect, it } from 'vitest'
import {
  resolveFamilyIconUrl,
  resolveFamilySealChar,
} from './FamilyIcon'

describe('FamilyIcon 辅助函数', () => {
  it('resolveFamilySealChar 优先取姓氏首字并支持空白回退', () => {
    expect(resolveFamilySealChar({ surname: '欧阳', name: '清河张氏' })).toBe(
      '欧'
    )
    expect(resolveFamilySealChar({ surname: '   ', name: ' 清河张氏 ' })).toBe(
      '清'
    )
    expect(resolveFamilySealChar({ surname: '', name: '' })).toBe('谱')
    expect(resolveFamilySealChar(null)).toBe('谱')
  })

  it('resolveFamilyIconUrl 正确拼接并编码项目媒体地址', () => {
    expect(resolveFamilyIconUrl('proj-1', null)).toBeNull()
    expect(resolveFamilyIconUrl('proj-1', '   ')).toBeNull()
    expect(resolveFamilyIconUrl('', 'crest.png')).toBeNull()
    expect(resolveFamilyIconUrl('proj-1', 'crest #1.png')).toBe(
      '/api/v1/projects/proj-1/media/crest%20%231.png'
    )
    expect(
      resolveFamilyIconUrl('proj-1', '/api/v1/projects/proj-1/media/a.png')
    ).toBe('/api/v1/projects/proj-1/media/a.png')
    expect(resolveFamilyIconUrl('proj-1', 'blob:https://app/123')).toBe(
      'blob:https://app/123'
    )
  })
})
