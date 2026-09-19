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


result = asyncjs("""
const profile = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
if (!['/tmp/hidden-space-zen-test','/private/tmp/hidden-space-zen-test'].includes(profile)) throw new Error('Test profile required');
const sine = ChromeUtils.importESModule('chrome://userscripts/content/core/manager.sys.mjs').default;
await sine.rebuildMods();
const tab = gBrowser.addTrustedTab('about:preferences#tabsBrowsing');
gBrowser.selectedTab = tab;
await new Promise(r=>setTimeout(r,2500));
const doc = tab.linkedBrowser.contentDocument;
const section = doc.getElementById('split-link-settings');
if (!section) return {error:'missing section', panes:[...doc.querySelectorAll('setting-pane')].map(p=>p.getAttribute('data-category'))};
const checkbox = doc.getElementById('split-link-enabled');
const select = doc.getElementById('split-link-trigger');
const visible = !section.hidden && section.getBoundingClientRect().height > 0;
Services.prefs.setBoolPref('uc.alt-click-split-view.enabled', true);
select.value = 'meta';
select.dispatchEvent(new doc.defaultView.Event('change', {bubbles:true}));
const saved = Services.prefs.getStringPref('uc.alt-click-split-view.trigger') === 'meta';
Services.prefs.setStringPref('uc.alt-click-split-view.trigger', 'alt');
const reflected = select.value === 'alt';
checkbox.click();
const disabled = !Services.prefs.getBoolPref('uc.alt-click-split-view.enabled') && select.disabled;
doc.defaultView.SplitLinkSettings.destroy();
const unloaded = !doc.getElementById('split-link-settings');
gBrowser.removeTab(tab);
return {visible,saved,reflected,disabled,unloaded};
""")['value']
call('WebDriver:DeleteSession')
assert all(v is True for v in result.values()), result
print(result)
