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
