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
    '\[string\]\$PythonPath',
    'ValidateRange\(1,\s*60\)',
    'CORS_ORIGINS',
    '\["http://localhost:5173"\]',
    'VITE_DATA_SOURCE',
    'VITE_BACKEND_URL',
    'Start-Process',
    'WindowStyle\s+Hidden',
    'api/health',
    'function\s+Wait-HttpReady',
    'function\s+Stop-StartedProcesses',
    'Invoke-WebRequest',
    'Stop-Process\s+-Id\s+\$process\.Id',
    'taskkill\.exe',
    '/T'
)) {
    if ($launcher -notmatch $requiredPattern) {
        throw "Launcher is missing required behavior: $requiredPattern"
    }
}

$virtualEnvironmentSelection = $launcher.IndexOf('$virtualEnvironmentPython')
$globalPythonFallback = $launcher.IndexOf("Get-RequiredCommand -Name 'python'")
if ($virtualEnvironmentSelection -lt 0 -or $globalPythonFallback -lt 0 -or $globalPythonFallback -le $virtualEnvironmentSelection) {
    throw 'Launcher must select backend/.venv Python before requiring global python as a fallback.'
}

if ($launcher -notmatch 'if \(\$PythonPath\)' -or $launcher -notmatch 'Resolve-Path -LiteralPath \$PythonPath') {
    throw 'Launcher must safely validate an explicitly supplied PythonPath.'
}

if ($launcher -match 'Frontend \(browser and health check\)' -or $launcher -match 'Frontend browser and health check') {
    throw 'The Vite root URL must not be described as a health check.'
}

Write-Output 'start-mvp launcher checks passed.'
