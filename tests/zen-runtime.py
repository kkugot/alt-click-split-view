"""Runtime checks for a dedicated headless Zen test profile on port 2829."""
import socket
import json

s = socket.create_connection(('127.0.0.1', 2829))
s.settimeout(40)

def recv():
    n = b''
    while not n.endswith(b':'):
        n += s.recv(1)
    data = b''
    while len(data) < int(n[:-1]):
        data += s.recv(int(n[:-1]) - len(data))
    return json.loads(data)

recv()
counter = 0

def call(name, args=None):
    global counter
    counter += 1
    data = json.dumps([0, counter, name, args or {}]).encode()
    s.sendall(str(len(data)).encode() + b':' + data)
    response = recv()
    if response[2]:
        raise Exception(response[2])
    return response[3]

call('WebDriver:NewSession', {'capabilities': {'alwaysMatch': {'acceptInsecureCerts': True}}})
call('Marionette:SetContext', {'value': 'chrome'})

def asyncjs(script):
    return call('WebDriver:ExecuteAsyncScript', {
        'script': 'const done = arguments[arguments.length - 1]; (async () => {' + script + '})().then(done, e => done({error:String(e),stack:e.stack}));',
        'args': [], 'newSandbox': False, 'sandbox': 'system', 'scriptTimeout': 30000,
    })

result = asyncjs('''
const profile = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
if (!['/private/tmp/hidden-space-zen-test', '/tmp/hidden-space-zen-test'].includes(profile)) throw new Error('Disposable profile required: ' + profile);
Services.prefs.setBoolPref('sine.allow-unsafe-js', true);
const sine = ChromeUtils.importESModule('chrome://userscripts/content/core/manager.sys.mjs').default;
await sine.rebuildMods();
const deadline = Date.now() + 4000;
while (!window.AltClickSplitView && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
if (!window.AltClickSplitView) throw new Error('Alt-click Split View did not load');

Services.prefs.setBoolPref('uc.alt-click-split-view.enabled', true);
Services.prefs.setBoolPref('zen.glance.enabled', false);
Services.prefs.setStringPref('uc.alt-click-split-view.trigger', 'alt');
const sourceTab = gBrowser.addTrustedTab('data:text/html,<h1>Original page</h1>');
gBrowser.selectedTab = sourceTab;
await new Promise(r => setTimeout(r, 300));
const sourceURL = sourceTab.linkedBrowser.currentURI.spec;
const actor = sourceTab.linkedBrowser.browsingContext.currentWindowGlobal.getActor('ClickHandler');
const {ClickHandlerParent} = ChromeUtils.importESModule('resource:///actors/ClickHandlerParent.sys.mjs');
actor.receiveMessage({name:'Content:Click', data:{button:0, altKey:true, ctrlKey:false, metaKey:false, shiftKey:false,
  href:'https://example.com/alt-click-split-view-test', referrerInfo:null, policyContainer:null}});
const splitDeadline = Date.now() + 4000;
while (!sourceTab.splitView && Date.now() < splitDeadline) await new Promise(r => setTimeout(r, 100));
const split = gZenViewSplitter._data.find(group => group.tabs.includes(sourceTab));
const altClickSplit = split?.tabs.length === 2 && split.tabs.includes(gBrowser.selectedTab) &&
  sourceTab.splitView && !sourceTab.splitview &&
  gZenViewSplitter.splitViewBrowsers.includes(sourceTab.linkedBrowser);
if (!altClickSplit) throw new Error('Expected native Zen split, not Firefox wrapper');
await new Promise(r => setTimeout(r, 300));
const sourceRect = sourceTab.linkedBrowser.getBoundingClientRect();
const targetRect = gBrowser.selectedBrowser.getBoundingClientRect();
const bothPanesVisible = sourceTab.linkedBrowser.currentURI.spec === sourceURL &&
  sourceRect.width > 100 && sourceRect.height > 100 && targetRect.width > 100 &&
  Math.abs(sourceRect.x - targetRect.x) > 100 && sourceTab.linkedBrowser.docShellIsActive;
const originalBrowser = sourceTab.linkedBrowser;
gBrowser.selectedTab = sourceTab;
actor.receiveMessage({name:'Content:Click', data:{button:0, altKey:true, ctrlKey:false, metaKey:false, shiftKey:false,
  href:'https://example.com/second-split-test', referrerInfo:null, policyContainer:null}});
const extendsZenSplit = split.tabs.length === 3 && sourceTab.linkedBrowser === originalBrowser &&
  gZenViewSplitter.splitViewBrowsers.length === 3 && !sourceTab.splitview;
if (split) for (const tab of [...split.tabs]) gBrowser.removeTab(tab);
Services.prefs.setStringPref('uc.alt-click-split-view.trigger', 'ctrl');
const triggerTab = gBrowser.selectedTab;
const triggerCount = gBrowser.tabs.length;
const triggerActor = triggerTab.linkedBrowser.browsingContext.currentWindowGlobal.getActor('ClickHandler');
triggerActor.receiveMessage({name:'Content:Click', data:{button:0, altKey:true, ctrlKey:false, metaKey:false, shiftKey:false,
  href:'https://example.com/ignored-alt-test', referrerInfo:null, policyContainer:null}});
const triggerChanged = !triggerTab.splitView && gBrowser.selectedTab === triggerTab && gBrowser.tabs.length === triggerCount;
Services.prefs.setBoolPref('uc.alt-click-split-view.enabled', false);
triggerActor.receiveMessage({name:'Content:Click', data:{button:0, altKey:false, ctrlKey:true, metaKey:false, shiftKey:false,
  href:'https://example.com/disabled-test', referrerInfo:null, policyContainer:null}});
const disabled = !triggerTab.splitView && gBrowser.selectedTab === triggerTab && gBrowser.tabs.length === triggerCount;
const normalTab = gBrowser.selectedTab;
const normalCount = gBrowser.tabs.length;
const normalActor = normalTab.linkedBrowser.browsingContext.currentWindowGlobal.getActor('ClickHandler');
normalActor.receiveMessage({name:'Content:Click', data:{button:0, altKey:false, ctrlKey:false, metaKey:false, shiftKey:false,
  href:'https://example.com/normal-click-test', referrerInfo:null, policyContainer:null}});
const normalClickPreserved = !normalTab.splitView && gBrowser.selectedTab === normalTab && gBrowser.tabs.length === normalCount;
const browserTab = gBrowser.selectedTab;
const settingsTab = gBrowser.addTrustedTab('about:preferences#sineMods');
gBrowser.selectedTab = settingsTab;
await new Promise(r => setTimeout(r, 2500));
const settingsDoc = settingsTab.linkedBrowser.contentDocument;
const modItem = settingsDoc.querySelector('.sineItem[mod-id="alt-click-split-view"]');
const configure = modItem?.querySelector('.sineItemConfigureButton');
configure?.click();
await new Promise(r => setTimeout(r, 100));
const preferenceContent = modItem?.querySelector('.sineItemPreferenceDialogContent');
const settingsVisible = !!modItem && !!configure &&
  !!preferenceContent?.querySelector('.sineItemPreferenceCheckbox') &&
  !!preferenceContent?.querySelector('menulist') &&
  preferenceContent.querySelectorAll('menuitem').length === 5;
settingsTab.linkedBrowser.contentDocument.querySelector('.sineItemPreferenceDialog')?.close();
gBrowser.removeTab(settingsTab);
gBrowser.selectedTab = browserTab;
window.AltClickSplitView.destroy();
const afterUnload = !window.AltClickSplitView;
return {settingsVisible, bothPanesVisible, extendsZenSplit, altClickSplit, triggerChanged, disabled, normalClickPreserved, afterUnload,
  hookRestored:!ClickHandlerParent.prototype.__altClickSplitViewHook};
''')
if 'error' in result or 'error' in result.get('value', {}):
    raise AssertionError(result)
if not all(result['value'][key] for key in ('settingsVisible', 'bothPanesVisible', 'extendsZenSplit', 'altClickSplit', 'triggerChanged', 'disabled', 'normalClickPreserved', 'afterUnload', 'hookRestored')):
    raise AssertionError(result)
call('WebDriver:DeleteSession')
print('9 Alt-click Split View runtime checks passed')
