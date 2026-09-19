const assert = require('node:assert/strict');
const { test } = require('node:test');
const preferences = require('../preferences.json');
let policy;
try { policy = require('../alt-click-split-view.uc.js'); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

test('only the selected modifier on a primary link opts into split view', () => {
  assert.ok(policy, 'Alt-click Split View policy is implemented');
  assert.equal(policy.shouldSplitLinkClick({
    button: 0,
    href: 'https://example.com',
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  }), true);
  assert.equal(policy.shouldSplitLinkClick({
    button: 0,
    href: 'https://example.com',
    altKey: false,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
  }, 'ctrl'), true);
  assert.equal(policy.shouldSplitLinkClick({
    button: 0,
    href: 'https://example.com',
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  }, 'ctrl'), false);
  assert.equal(policy.shouldSplitLinkClick({
    button: 0,
    href: 'https://example.com',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
  }, 'shift'), true);
  for (const data of [
    { button: 1, altKey: true },
    { button: 0, altKey: false },
    { button: 0, altKey: true, ctrlKey: true },
    { button: 0, altKey: true, metaKey: true },
    { button: 0, altKey: true, shiftKey: true },
    { button: 0, altKey: true, href: '' },
  ]) {
    assert.equal(policy.shouldSplitLinkClick({ href: 'https://example.com', ...data }), false);
  }
});

test('Sine preferences expose the enable toggle and four trigger choices', () => {
  const enabled = preferences.find(pref => pref.property === 'uc.alt-click-split-view.enabled');
  const trigger = preferences.find(pref => pref.property === 'uc.alt-click-split-view.trigger');
  assert.equal(enabled.type, 'checkbox');
  assert.equal(enabled.defaultValue, true);
  assert.equal(trigger.type, 'dropdown');
  assert.deepEqual(trigger.options.map(option => option.value), ['ctrl', 'alt', 'shift', 'meta']);
  assert.equal(trigger.defaultValue, 'alt');
});
