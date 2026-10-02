// ==UserScript==
// @name           Alt-click Split View
// @author         Kostiantyn Kugot
// @version        1.4.0
// @description    Open Alt-clicked links in Zen Split View.
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(() => {
  const ENABLED_PREF = 'uc.alt-click-split-view.enabled';
  const TRIGGER_PREF = 'uc.alt-click-split-view.trigger';
  const HOVER_PREF = 'uc.alt-click-split-view.focus-on-hover';
  const MODIFIER_KEYS = Object.freeze({
    ctrl: 'ctrlKey',
    alt: 'altKey',
    shift: 'shiftKey',
    meta: 'metaKey',
  });

  function shouldSplitLinkClick(data, trigger = 'alt') {
    const modifier = MODIFIER_KEYS[trigger];
    return data?.button === 0 && Boolean(data.href) && modifier &&
      data[modifier] === true &&
      Object.values(MODIFIER_KEYS).every(key => key === modifier || !data[key]);
  }

  function installHoverFocus(win, prefs) {
    let timer = 0, pendingPane = null;
    const cancel = () => {
      if (timer) win.clearTimeout(timer);
      timer = 0;
      pendingPane = null;
    };
    const allowed = () => prefs.getBoolPref(HOVER_PREF, false) && win.document.hasFocus() &&
      win.gBrowser.tabpanels.getAttribute('zen-split-view') === 'true' &&
      !win.document.documentElement.hasAttribute('customizing') &&
      win.document.documentElement.getAttribute('inDOMFullscreen') !== 'true' &&
      !win.gURLBar.focused && !win.gURLBar.view.isOpen &&
      !win.document.querySelector('panel[panelopen="true"], menupopup[open="true"]') &&
      !win.gZenGlanceManager?.getFocusedTab?.();
    const move = event => {
      if (event.buttons || !allowed()) { cancel(); return; }
      const pane = event.target?.closest?.('.browserSidebarContainer[zen-split="true"]:not(.zen-glance-overlay)');
      const browser = pane?.querySelector(':scope > .browserContainer > .browserStack > browser');
      if (!browser || browser === win.gBrowser.selectedBrowser || pane.parentNode !== win.gBrowser.tabpanels) { cancel(); return; }
      if (pane === pendingPane) return;
      cancel();
      pendingPane = pane;
      timer = win.setTimeout(() => {
        cancel();
        if (!allowed() || !pane.isConnected || !pane.matches(':hover') || pane.getAttribute('zen-split') !== 'true') return;
        const tab = win.gBrowser.getTabForBrowser(browser);
        if (tab && !tab.closing) win.gBrowser.selectedTab = tab;
      }, 150);
    };
    const exit = event => { if (!event.relatedTarget) cancel(); };
    const events = [['mousemove', move], ['mouseout', exit], ['mousedown', cancel], ['keydown', cancel], ['dragstart', cancel], ['blur', cancel]];
    for (const [name, handler] of events) win.addEventListener(name, handler, true);
    return () => {
      cancel();
      for (const [name, handler] of events) win.removeEventListener(name, handler, true);
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { shouldSplitLinkClick, installHoverFocus };
    return;
  }

  window.AltClickSplitView?.destroy();
  const hookKey = '__altClickSplitViewHook';
  let cleanup, cleanupHover;
  const report = error => console.error('[Alt-click Split View]', error);
  const enabled = () => Services.prefs.getBoolPref(ENABLED_PREF, true);
  const trigger = () => Services.prefs.getStringPref(TRIGGER_PREF, 'alt');

  function install() {
    let ClickHandlerParent;
    try {
      ({ ClickHandlerParent } = ChromeUtils.importESModule('resource:///actors/ClickHandlerParent.sys.mjs'));
    } catch (error) {
      report(error);
      return () => {};
    }
    const prototype = ClickHandlerParent?.prototype;
    if (!prototype || typeof prototype.contentAreaClick !== 'function') return () => {};

    let state = prototype[hookKey];
    if (!state) {
      state = { original: prototype.contentAreaClick, windows: new Map() };
      state.wrapped = function (data) {
        const browser = this.manager?.browsingContext?.top?.embedderElement;
        const win = browser?.documentGlobal;
        const handler = state.windows.get(win) ||
          [...state.windows].find(([owner]) => owner.gBrowser === win?.gBrowser)?.[1];
        if (handler?.(this, browser, data)) return;
        return state.original.call(this, data);
      };
      Object.defineProperty(prototype, hookKey, { value: state, configurable: true });
      prototype.contentAreaClick = state.wrapped;
    }

    const handle = (_actor, browser, data) => {
      if (!enabled() || !shouldSplitLinkClick(data, trigger())) return false;
      // Glance owns the gesture in the content process; never race its action.
      if (Services.prefs.getBoolPref('zen.glance.enabled', true) &&
          Services.prefs.getStringPref('zen.glance.activation-method', 'alt') === trigger()) return false;
      const win = browser?.documentGlobal;
      const currentTab = win?.gZenGlanceManager?.getTabOrGlanceParent(win.gBrowser.getTabForBrowser(browser));
      const nativeOpenLinkIn = win?.openLinkIn;
      if (!win || !currentTab || typeof nativeOpenLinkIn !== 'function' ||
          typeof win.gZenViewSplitter?.splitTabs !== 'function') return false;
      if (!win.gZenViewSplitter.canOpenLinkInSplitView()) {
        win.gZenUIManager.showToast('zen-split-view-limit-toast');
        return true;
      }

      const hookedOpenLinkIn = function (url, where, params) {
        if (url !== data.href || where !== 'tab') {
          return nativeOpenLinkIn.call(this, url, where, params);
        }
        // Match Zen's own splitLinkInNewTab, retaining native click security metadata.
        const linkTab = win.gZenViewSplitter.openAndSwitchToTab(url, {
          ...params,
          skipRoute: true,
          inBackground: false,
        });
        if (linkTab) win.gZenViewSplitter.splitTabs([currentTab, linkTab], undefined, 1);
        return linkTab;
      };
      win.openLinkIn = hookedOpenLinkIn;
      try {
        // Make Zen's native click path create a foreground tab, then split it.
        state.original.call(_actor, {
          ...data,
          altKey: false,
          ctrlKey: true,
          metaKey: true,
          shiftKey: false,
        });
      } finally {
        if (win.openLinkIn === hookedOpenLinkIn) win.openLinkIn = nativeOpenLinkIn;
      }
      return true;
    };

    state.windows.set(window, handle);
    return () => {
      state.windows.delete(window);
      if (!state.windows.size && prototype.contentAreaClick === state.wrapped) {
        prototype.contentAreaClick = state.original;
        delete prototype[hookKey];
      }
    };
  }

  function destroy() {
    cleanupHover?.();
    cleanupHover = null;
    cleanup?.();
    cleanup = null;
    window.removeEventListener('unload', destroy);
    delete window.AltClickSplitView;
  }

  window.AltClickSplitView = { destroy };
  for (const pref of [ENABLED_PREF, TRIGGER_PREF, HOVER_PREF]) {
    Services.prefs.setBoolPref(`services.sync.prefs.sync.${pref}`, false);
    Services.prefs.setBoolPref(`services.sync.prefs.sync-seen.${pref}`, false);
  }
  window.addUnloadListener?.(destroy);
  window.addEventListener('unload', destroy, { once: true });
  cleanup = install();
  cleanupHover = installHoverFocus(window, Services.prefs);
})();
