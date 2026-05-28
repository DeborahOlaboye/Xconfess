#!/usr/bin/env bash
set -euo pipefail

# XConfess Full-Stack Smoke Test
# Verifies backend liveness and frontend reachability.
# Exits nonzero on failure — suitable for CI or local demo checks.

BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMEOUT_SEC="${TIMEOUT_SEC:-10}"

pass=0
fail=0

pass_msg()  { echo "  PASS: $1";  ((pass++)); }
fail_msg() { echo "  FAIL: $1"; ((fail++)); }

echo "============================================"
echo " XConfess Full-Stack Smoke Test"
echo " Date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "============================================"
echo ""

# ---- Backend liveness ----
echo "--- Backend liveness ($BACKEND_URL) ---"
if status_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SEC" "${BACKEND_URL}/health/live" 2>/dev/null); then
  if [ "$status_code" = "200" ]; then
    pass_msg "GET /health/live returned 200"
  else
    fail_msg "GET /health/live returned $status_code (expected 200)"
  fi
else
  fail_msg "GET /health/live — unreachable"
fi

# ---- Frontend reachability ----
echo "--- Frontend reachability ($FRONTEND_URL) ---"
if status_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SEC" "${FRONTEND_URL}" 2>/dev/null); then
  if [ "$status_code" = "200" ]; then
    pass_msg "GET / returned 200"
  else
    fail_msg "GET / returned $status_code (expected 200)"
  fi
else
  fail_msg "GET / — unreachable"
fi

# ---- Frontend login/home route ----
echo "--- Frontend login/home route ---"
if content=$(curl -s --max-time "$TIMEOUT_SEC" "${FRONTEND_URL}" 2>/dev/null); then
  if echo "$content" | grep -qi '<html'; then
    pass_msg "Root route returns HTML"
  else
    fail_msg "Root route did not return HTML"
  fi
else
  fail_msg "Root route — unreachable"
fi

echo ""
echo "============================================"
echo " Results: $pass passed, $fail failed"
echo "============================================"

if [ "$fail" -gt 0 ]; then
  exit 1
fi
exit 0
