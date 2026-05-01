#!/bin/bash
# PostToolUse hook: Scans written/edited files for security issues
# Exit 0 = pass (with optional warning), Exit 2 = block

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | python3 -c "import json,sys; ti=json.load(sys.stdin).get('tool_input',{}); print(ti.get('file_path', ti.get('command','')))" 2>/dev/null)

# Only check Write and Edit operations
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# Skip non-code files
case "$FILE_PATH" in
  *.md|*.txt|*.json|*.yml|*.yaml|*.toml|*.lock|*.css|*.svg|*.png|*.jpg)
    exit 0
    ;;
esac

ISSUES=""

if [[ -f "$FILE_PATH" ]]; then
  # Check for hardcoded secrets
  if grep -nEi '(api[_-]?key|secret|password|token|credential)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{8,}' "$FILE_PATH" 2>/dev/null | grep -v '\.env' | grep -v 'example' | grep -v 'test' | head -3; then
    ISSUES="${ISSUES}Potential hardcoded secret detected. "
  fi

  # Check for eval/exec patterns
  if grep -nE '(eval\(|new Function\(|child_process\.exec\(|os\.system\(|subprocess\.call\()' "$FILE_PATH" 2>/dev/null | head -3; then
    ISSUES="${ISSUES}Dangerous eval/exec pattern detected. "
  fi

  # Check for SQL injection vectors
  if grep -nE '(query\(.*\$\{|query\(.*\+\s|execute\(.*\+\s|`SELECT.*\$\{)' "$FILE_PATH" 2>/dev/null | head -3; then
    ISSUES="${ISSUES}Potential SQL injection — use parameterized queries. "
  fi

  # Check for innerHTML/dangerouslySetInnerHTML
  if grep -nE '(innerHTML\s*=|dangerouslySetInnerHTML|document\.write\()' "$FILE_PATH" 2>/dev/null | head -3; then
    ISSUES="${ISSUES}XSS risk: innerHTML/dangerouslySetInnerHTML usage. "
  fi
fi

if [[ -n "$ISSUES" ]]; then
  echo "{\"systemMessage\": \"⚠️ Security warning in $FILE_PATH: $ISSUES Review and fix before shipping.\"}"
fi

exit 0
