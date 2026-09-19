#!/usr/bin/env python3
"""Link this checkout into an existing Sine profile. Restart Zen afterward."""
import argparse
import json
from datetime import datetime
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('profile', type=Path, help='Zen profile directory containing chrome/sine-mods')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1]
mods_dir = args.profile.expanduser().resolve() / 'chrome' / 'sine-mods'
registry = mods_dir / 'mods.json'
if not registry.is_file():
    parser.error(f'Sine registry not found: {registry}')
mods = json.loads(registry.read_text())
manifest = json.loads((source / 'theme.json').read_text())
link = mods_dir / manifest['id']
if link.is_symlink():
    if link.resolve() != source:
        parser.error(f'Existing symlink points elsewhere: {link}')
elif link.exists():
    parser.error(f'Refusing to replace existing mod directory: {link}')

backup = registry.with_name(f'mods.json.backup-alt-click-split-view-{datetime.now():%Y%m%d-%H%M%S-%f}')
backup.write_bytes(registry.read_bytes())
if not link.is_symlink():
    link.symlink_to(source, target_is_directory=True)
mods[manifest['id']] = {**manifest, 'enabled': True, 'no-updates': True}
temporary = registry.with_name('mods.json.alt-click-split-view.tmp')
temporary.write_text(json.dumps(mods, indent=2) + '\n')
temporary.replace(registry)
print(f'Linked: {link} -> {source}')
print(f'Registry backup: {backup}')
print('Restart Zen to load Alt-click Split View.')
