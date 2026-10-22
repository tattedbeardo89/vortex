#!/usr/bin/env bash
# Preserve the complete runner's exit status; expose its failing native log through check annotations.
set -uo pipefail
mkdir -p .vortex
xvfb-run -a -s '-screen 0 1920x1080x24' npm run test:framework 2>&1 | tee .vortex/framework-ci.log
framework_status=${PIPESTATUS[0]}
if [ "$framework_status" -ne 0 ]; then
  python3 - <<'PY'
from pathlib import Path
import re
log = Path('.vortex/framework-ci.log').read_text(errors='replace')
paths = re.findall(r'Failed\. Full log: (.+)', log)
details = Path(paths[-1]).read_text(errors='replace') if paths and Path(paths[-1]).is_file() else log
# Native fixture assertions can span lines. Escape workflow command delimiters; never mask the failure.
message = details[-12000:].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
print('::error title=Framework failure details::' + message)
PY
fi
exit "$framework_status"
