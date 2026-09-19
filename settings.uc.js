// Alt-click Split View settings · Kostiantyn Kugot · 1.3.0
(() => {
  window.SplitLinkSettings?.destroy();
  const enabledPref = 'uc.alt-click-split-view.enabled';
  const triggerPref = 'uc.alt-click-split-view.trigger';
  const glanceEnabledPref = 'zen.glance.enabled';
  const glanceTriggerPref = 'zen.glance.activation-method';
  const observedPrefs = [enabledPref, triggerPref, glanceEnabledPref, glanceTriggerPref];
  const html = (tag) => document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  let section, enabled, trigger, error;

  function refresh() {
    if (!section) return;
    enabled.checked = Services.prefs.getBoolPref(enabledPref, true);
    trigger.value = Services.prefs.getStringPref(triggerPref, 'alt');
    trigger.disabled = !enabled.checked;
    const conflict = enabled.checked && Services.prefs.getBoolPref(glanceEnabledPref, true) &&
      trigger.value === Services.prefs.getStringPref(glanceTriggerPref, 'alt');
    trigger.setAttribute('aria-invalid', String(conflict));
    trigger.setCustomValidity(conflict ? 'This modifier is already used by Glance.' : '');
    error.hidden = !conflict;
    const message = conflict
      ? `${trigger.selectedOptions[0]?.textContent || trigger.value} is already used by Glance. Choose a different trigger here or in Glance settings. Split View is inactive while these shortcuts conflict.`
      : '';
    if (error.textContent !== message) error.textContent = message;
  }

  function mount() {
    const pane = document.querySelector('setting-pane[data-category="paneTabsBrowsing"]');
    if (!pane) return;
    if (!section) {
      section = document.createXULElement('groupbox');
      section.id = 'split-link-settings';
      section.setAttribute('data-category', 'paneTabsBrowsing');
      const card = html('moz-card');
      card.setAttribute('role', 'presentation');
      section.style.marginBlock = 'var(--space-large, 24px)';
      const fieldset = html('moz-fieldset');
      fieldset.label = 'Open links in Split View';
      fieldset.headingLevel = 3;
      fieldset.iconSrc = 'chrome://browser/skin/zen-icons/split.svg';
      fieldset.description = 'Show a linked page beside the current tab.';
      const toggleLabel = html('label');
      enabled = html('input');
      enabled.type = 'checkbox';
      enabled.id = 'split-link-enabled';
      toggleLabel.append(enabled, ' Enable modifier-click Split View');
      const triggerLabel = html('label');
      triggerLabel.textContent = 'Trigger method';
      triggerLabel.htmlFor = 'split-link-trigger';
      trigger = html('select');
      trigger.id = 'split-link-trigger';
      for (const [value, label] of [['ctrl', 'Ctrl'], ['alt', 'Alt'], ['shift', 'Shift'], ['meta', 'Meta (Command)']]) {
        const option = html('option');
        option.value = value;
        option.textContent = label + ' + Click';
        trigger.append(option);
      }
      const row = html('div');
      row.style.cssText = 'display:flex;align-items:center;gap:16px;margin-top:16px';
      row.append(triggerLabel, trigger);
      error = html('moz-message-bar');
      error.id = 'split-link-conflict';
      error.setAttribute('type', 'error');
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'polite');
      trigger.setAttribute('aria-describedby', error.id);
      fieldset.append(toggleLabel, row, error);
      card.append(fieldset);
      section.append(card);
      enabled.addEventListener('change', () => Services.prefs.setBoolPref(enabledPref, enabled.checked));
      trigger.addEventListener('change', () => Services.prefs.setStringPref(triggerPref, trigger.value));
      pane.after(section);
      refresh();
    }
    section.hidden = pane.hidden;
  }

  const observer = { observe: refresh };
  const domObserver = new MutationObserver(mount);
  domObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('paneshown', mount);
  for (const pref of observedPrefs) Services.prefs.addObserver(pref, observer);
  function destroy() {
    domObserver.disconnect();
    document.removeEventListener('paneshown', mount);
    for (const pref of observedPrefs) Services.prefs.removeObserver(pref, observer);
    window.removeEventListener('unload', destroy);
    section?.remove();
    delete window.SplitLinkSettings;
  }
  window.SplitLinkSettings = { destroy };
  window.addUnloadListener?.(destroy);
  window.addEventListener('unload', destroy, { once: true });
  mount();
})();
