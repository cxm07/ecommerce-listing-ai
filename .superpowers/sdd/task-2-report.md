# Task 2 Report: Reproducible Local Launcher

## Changes

- Added `scripts/start-mvp.ps1` with an optional `-NoBrowser` switch.
- The launcher checks `python`, `node`, and `npm`; uses `backend/.venv/Scripts/python.exe` when present; refuses to start if ports 8000 or 5173 are already in use; and never terminates existing processes.
- FastAPI receives `CORS_ORIGINS=["http://localhost:5173"]` through its process environment. Vite receives `VITE_DATA_SOURCE=api` and `VITE_BACKEND_URL=http://localhost:8000` through its process environment. No `.env` file is created or edited.
- Added a PowerShell static behavior/AST test at `scripts/tests/start-mvp.tests.ps1`.
- Updated frontend/backend environment examples and README installation, launch, stop, API-mode, and in-memory storage guidance.

## Verification

- `scripts/tests/start-mvp.tests.ps1`: passed.
- PowerShell AST parse of `scripts/start-mvp.ps1`: passed.
- `scripts/start-mvp.ps1 -NoBrowser`: reached backend dependency preflight and failed safely before starting either service because the available Python is 3.14 and the project dependencies are not installed for it.
- `npm ci` completed for the frontend. npm reported four dependency audit findings (three high, one critical); they were not modified in this task.

## Concern

The current machine exposes only Python 3.14. The pinned dependency set did not install successfully in the created backend virtual environment, so an actual two-server startup and HTTP health check could not be completed here. Use a Python version compatible with the pinned dependencies, create `backend/.venv`, and run `pip install -e ".[dev]"`; the launcher will preferentially use that virtual environment.

## Review Follow-up: I1, M1, M2

- The launcher now chooses an explicitly supplied, existing `-PythonPath` only when requested; otherwise it chooses `backend/.venv/Scripts/python.exe` before requiring global `python` as a fallback. This avoids any hard-coded machine-specific interpreter path.
- It waits for `GET /api/health` and for the Vite root browser URL with a bounded `-StartupTimeoutSeconds` (default 30, range 1-60). A failure stops only the tracked process trees created by this invocation, including an `npm`-spawned Vite child process.
- The README and launcher now call `http://localhost:5173/` a frontend browser URL, not a health endpoint.
- Static PowerShell coverage was extended before the implementation. The initial red run failed as expected with `Launcher is missing required behavior: \[string\]\$PythonPath`. The subsequent verification command was:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tests\start-mvp.tests.ps1
  $tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'scripts\start-mvp.ps1'), [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count -gt 0) { $errors | ForEach-Object { $_.Message }; exit 1 }; Write-Output 'PowerShell AST parse passed.'
  git diff --check
  ```

  Output: `start-mvp launcher checks passed.` and `PowerShell AST parse passed.`; `git diff --check` reported no whitespace errors (only Git line-ending warnings).

## Remaining concern

No real two-server launch was performed for this follow-up, to avoid retaining child processes and because the available Python/dependency combination remains incompatible. The bounded readiness path is covered statically; verify it on a machine with a compatible backend virtual environment before relying on it for a demo.
