import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseInviteSearch, sanitizeRedirectPath } from './redirect.ts';

test('sanitizeRedirectPath allows valid same-origin relative paths and trims whitespace', () => {
  assert.equal(sanitizeRedirectPath('/home'), '/home');
  assert.equal(sanitizeRedirectPath('  /projects/123?tab=lineage#top  '), '/projects/123?tab=lineage#top');
  assert.equal(sanitizeRedirectPath('/onboarding?invite=abc-123'), '/onboarding?invite=abc-123');
});

test('sanitizeRedirectPath rejects protocol-relative, external URLs, and non-slash paths', () => {
  assert.equal(sanitizeRedirectPath(undefined), undefined);
  assert.equal(sanitizeRedirectPath(null), undefined);
  assert.equal(sanitizeRedirectPath(42), undefined);
  assert.equal(sanitizeRedirectPath(''), undefined);
  assert.equal(sanitizeRedirectPath('   '), undefined);
  assert.equal(sanitizeRedirectPath('//evil.example.com'), undefined);
  assert.equal(sanitizeRedirectPath('  //evil.example.com/login  '), undefined);
  assert.equal(sanitizeRedirectPath('https://evil.example.com/home'), undefined);
  assert.equal(sanitizeRedirectPath('http://localhost:3000/home'), undefined);
  assert.equal(sanitizeRedirectPath('javascript:alert(1)'), undefined);
  assert.equal(sanitizeRedirectPath('home'), undefined);
});

test('parseInviteSearch extracts trimmed invite token and ignores empty or invalid values', () => {
  assert.deepEqual(parseInviteSearch({ invite: '  token-xyz  ' }), { invite: 'token-xyz' });
  assert.deepEqual(parseInviteSearch({ invite: '   ' }), {});
  assert.deepEqual(parseInviteSearch({ invite: '' }), {});
  assert.deepEqual(parseInviteSearch({ invite: 123 }), {});
  assert.deepEqual(parseInviteSearch({}), {});
});
