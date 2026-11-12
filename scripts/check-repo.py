#!/usr/bin/env python3
"""Check staged Git contents; report paths/rules only, never secret values."""
import json
import re
import subprocess
from pathlib import Path


def git(*args):
    return subprocess.check_output(['git', *args])


root = Path(git('rev-parse', '--show-toplevel').decode().strip())
entries = git('ls-files', '--stage', '-z').split(b'\0')
rules = {
    'API credential': rb'(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})',
    'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'stored password hash': rb'scrypt:[a-f0-9]{32}:[a-f0-9]{128}',
    'personal absolute path': rb'/(?:Users|home)/[A-Za-z0-9._-]+/',
}
private_paths = re.compile(r'^other/|(^|/)(?:data|pal|artifacts|node_modules|dist|test-results|playwright-report|__pycache__|\.idea|\.vscode)/|(^|/)(?:\.env(?:\..*)?|[^/]*apikey[^/]*\.txt|[^/]*api_key[^/]*\.txt|accounts\.json[^/]*)$|\.(?:log|pid|pem|key|p12|pfx|bak|pyc)$|^[^/]+\.(?:png|jpe?g|webp)$', re.I)

# Compare local values in memory; none of these files or values are printed.
known = []
key_path = root / 'deepseek_apikey.txt'
if key_path.exists():
    key = key_path.read_bytes().strip()
    if len(key) >= 12:
        known.append(key)
accounts_path = root / 'data/accounts.json'
if accounts_path.exists():
    accounts = json.loads(accounts_path.read_text())
    for user in accounts.get('users', []):
        for field in ('id', 'passwordHash', 'email'):
            value = user.get(field)
            if isinstance(value, str) and len(value) >= 12:
                known.append(value.encode())

failures = []
count = total = 0
for entry in entries:
    if not entry:
        continue
    meta, raw_path = entry.split(b'\t', 1)
    mode, oid, stage = meta.decode().split()
    path = raw_path.decode()
    count += 1
    if private_paths.search(path):
        failures.append((path, 'private or excluded resource path'))
    if mode != '100644' and mode != '100755':
        failures.append((path, 'unexpected symlink/submodule/conflict'))
        continue
    data = git('cat-file', 'blob', oid)
    total += len(data)
    if any(value in data for value in known):
        failures.append((path, 'matches local private data'))
    for name, pattern in rules.items():
        if re.search(pattern, data):
            failures.append((path, name))

if failures:
    for path, reason in failures:
        print(f'BLOCKED: {path} ({reason})')
    raise SystemExit(1)
print(f'PASS: {count} staged files, {total / 1024 / 1024:.2f} MiB; no excluded paths or detected secrets.')
