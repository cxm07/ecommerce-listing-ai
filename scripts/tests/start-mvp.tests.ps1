$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$launcherPath = Join-Path $repositoryRoot 'scripts\start-mvp.ps1'

if (-not (Test-Path -LiteralPath $launcherPath)) {
    throw "Expected launcher at $launcherPath"
}

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($launcherPath, [ref]$tokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count -gt 0) {
    throw "Launcher has PowerShell syntax errors: $($parseErrors.Extent.Text -join ', ')"
}

$launcher = Get-Content -LiteralPath $launcherPath -Raw
foreach ($requiredPattern in @(
    '\[switch\]\$NoBrowser',
    'CORS_ORIGINS',
    '\["http://localhost:5173"\]',
    'VITE_DATA_SOURCE',
    'VITE_BACKEND_URL',
    'Start-Process',
    'WindowStyle\s+Hidden',
    'api/health'
)) {
    if ($launcher -notmatch $requiredPattern) {
        throw "Launcher is missing required behavior: $requiredPattern"
    }
}

Write-Output 'start-mvp launcher checks passed.'
