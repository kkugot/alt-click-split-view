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

test('hover selection is delayed, guarded, and cancelled on unload', () => {
  const listeners = new Map(), timers = new Map();
  let enabled = false, nextId = 0;
  const targetBrowser = {}, tab = { linkedBrowser: targetBrowser };
  const panels = { getAttribute: () => 'true' };
  const pane = { parentNode: panels, isConnected: true, matches: () => true,
    getAttribute: () => 'true', querySelector: () => targetBrowser };
  const win = {
    document: { hasFocus: () => true, documentElement: { hasAttribute: () => false, getAttribute: () => null }, querySelector: () => null },
    gBrowser: { tabpanels: panels, selectedBrowser: {}, getTabForBrowser: () => tab },
    gURLBar: { focused: false, view: { isOpen: false } },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    setTimeout: (fn, ms) => { assert.equal(ms, 150); timers.set(++nextId, fn); return nextId; },
    clearTimeout: id => timers.delete(id),
  };
  const cleanup = policy.installHoverFocus(win, { getBoolPref: () => enabled });
  const move = { buttons: 0, target: { closest: () => pane } };
  listeners.get('mousemove')(move);
  assert.equal(timers.size, 0);
  enabled = true;
  listeners.get('mousemove')(move);
  assert.equal(win.gBrowser.selectedTab, undefined);
  [...timers.values()][0]();
  assert.equal(win.gBrowser.selectedTab, tab);
  win.gBrowser.selectedTab = undefined;
  win.gURLBar.focused = true;
  listeners.get('mousemove')(move);
  assert.equal(timers.size, 0);
  win.gURLBar.focused = false;
  listeners.get('mousemove')(move);
  listeners.get('mousedown')();
  assert.equal(timers.size, 0);
  listeners.get('mousemove')(move);
  cleanup();
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
});

test('Sine preferences expose the enable toggle and four trigger choices', () => {
  const enabled = preferences.find(pref => pref.property === 'uc.alt-click-split-view.enabled');
  const trigger = preferences.find(pref => pref.property === 'uc.alt-click-split-view.trigger');
  assert.equal(enabled.type, 'checkbox');
  assert.equal(enabled.defaultValue, true);
  const hover = preferences.find(pref => pref.property === 'uc.alt-click-split-view.focus-on-hover');
  assert.equal(hover.type, 'checkbox');
  assert.equal(hover.defaultValue, false);
  assert.equal(trigger.type, 'dropdown');
  assert.deepEqual(trigger.options.map(option => option.value), ['ctrl', 'alt', 'shift', 'meta']);
  assert.equal(trigger.defaultValue, 'alt');
});
