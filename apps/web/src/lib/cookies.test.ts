import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'vitest'
import { Window } from 'happy-dom'
import { clearCookies } from '../test-utils/cookies'
import { getCookie, removeCookie, setCookie } from './cookies'

if (typeof globalThis.document === 'undefined') {
  const win = new Window({ url: 'https://localhost/' })
  globalThis.window = win as unknown as Window & typeof globalThis.window
  globalThis.document = win.document as unknown as Document
}

const COOKIE_PREFIX = 'test_cookie_'

describe('cookies', () => {
  const uniqueName = () =>
    `${COOKIE_PREFIX}${Math.random().toString(36).slice(2)}`

  beforeEach(() => {
    clearCookies(COOKIE_PREFIX)
  })

  it('stores a value that can be read back', () => {
    const name = uniqueName()
    const value = 'hello-world'

    setCookie(name, value)

    assert.equal(getCookie(name), value)
  })

  it('clears a value so it is no longer readable', () => {
    const name = uniqueName()

    setCookie(name, 'x')
    assert.equal(getCookie(name), 'x')

    removeCookie(name)

    assert.equal(getCookie(name), undefined)
  })
})
