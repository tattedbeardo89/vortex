"""Read one explicitly requested repository job's archived log on its GitHub runner."""
import json
import os
import re
import subprocess

jobs = os.environ['DIAGNOSTIC_JOB_IDS'].split(',')
repo = os.environ['GITHUB_REPOSITORY']
if not 1 <= len(jobs) <= 4 or not all(re.fullmatch(r'[0-9]+', job) for job in jobs) or repo != 'tattedbeardo89/vortex':
    raise SystemExit('Expected a numeric job ID in the Vortex repository')

def api(job, path):
    result = subprocess.run(['gh', 'api', '--allow-escape-sequences', f'repos/{repo}/actions/jobs/{job}{path}'], capture_output=True)
    if result.returncode:
        # gh errors can contain expiring storage URLs; do not publish those credentials.
        detail = re.sub(r'https://\S+', '[URL redacted]', result.stderr.decode(errors='replace'))[:1500]
        detail = f'Job {job}{path}: ' + detail
        detail = detail.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print('::error title=CI log retrieval failed::' + detail, flush=True)
        raise SystemExit('Unable to retrieve the requested repository job through the GitHub API')
    return result.stdout

for job in jobs:
    metadata = json.loads(api(job, ''))
    log = api(job, '/logs').decode(errors='replace')
    log = re.sub(r'\x1b\[[0-9;]*m', '', log)
    failures = [match.start() for match in re.finditer(r'not ok [0-9]+ - ', log)]
    if failures:
        excerpt = '\n'.join(log[start:start + 2000] for start in failures[:2])
    else:
        # Historical framework output can omit early failures; preserve totals or the terminal error.
        excerpt = log[-3000:]
    # Keep this a fixed, scoped diagnostic, not a generic URL/log relay. Redact any URLs with credentials.
    excerpt = re.sub(r'https://[^\s"<>]*[?][^\s"<>]*', '[URL with query redacted]', excerpt)
    # GitHub annotations truncate messages at 4 KiB; preserve the complete excerpt in small chunks.
    for offset in range(0, len(excerpt), 2400):
        message = f"Source job {job}; commit {metadata['head_sha']}; excerpt offset {offset}\n" + excerpt[offset:offset + 2400]
        message = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print('::notice title=Requested framework job log::' + message)
