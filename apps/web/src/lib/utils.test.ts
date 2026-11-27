import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getPageNumbers } from './utils'

describe('getPageNumbers', () => {
  it('returns all pages when total is at most 5', () => {
    assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3])
    assert.deepEqual(getPageNumbers(3, 5), [1, 2, 3, 4, 5])
  })

  it('shows ellipsis near the beginning', () => {
    assert.deepEqual(getPageNumbers(1, 10), [1, 2, 3, 4, '...', 10])
    assert.deepEqual(getPageNumbers(3, 10), [1, 2, 3, 4, '...', 10])
  })

  it('shows ellipsis near the end', () => {
    assert.deepEqual(getPageNumbers(10, 10), [1, '...', 7, 8, 9, 10])
    assert.deepEqual(getPageNumbers(9, 10), [1, '...', 7, 8, 9, 10])
  })

  it('shows ellipsis on both side in the middle', () => {
    assert.deepEqual(getPageNumbers(5, 10), [1, '...', 4, 5, 6, '...', 10])
  })

  it('handles current page greater than total pages', () => {
    assert.deepEqual(getPageNumbers(6, 5), [1, 2, 3, 4, 5])
    assert.deepEqual(getPageNumbers(11, 10), [1, '...', 7, 8, 9, 10])
  })
})
