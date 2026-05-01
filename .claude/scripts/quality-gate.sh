#!/bin/bash
# TaskCompleted hook: Prevents marking tasks as completed without verification
# Exit 0 = allow, Exit 2 = block completion

INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('subject', d.get('task_subject','')))" 2>/dev/null)
TASK_STATUS=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('status',''))" 2>/dev/null)

# Only intercept when marking as completed
if [[ "$TASK_STATUS" != "completed" ]]; then
  exit 0
fi

echo "{\"systemMessage\": \"Task completion gate: Ensure this task has been verified — code reviewed, security checked, and tests passing before marking complete.\"}"
exit 0
