[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$PythonPath,
    [ValidateRange(1, 60)]
    [int]$StartupTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendPath = Join-Path $repositoryRoot 'backend'
$frontendPath = Join-Path $repositoryRoot 'frontend'
$frontendUrl = 'http://localhost:5173/'
$backendHealthUrl = 'http://localhost:8000/api/health'

if ((Resolve-Path (Get-Location)).Path -ne $repositoryRoot) {
    throw "Run this launcher from the repository root: $repositoryRoot"
}

function Get-RequiredCommand {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "Required command '$Name' was not found. Install it and restart PowerShell."
    }

    return $command
}

function Test-LocalPortInUse {
    param([Parameter(Mandatory)][int]$Port)

    return [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains $Port
}

function Start-ProcessWithEnvironment {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$ArgumentList,
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [Parameter(Mandatory)][hashtable]$Environment
    )

    $previousValues = @{}
    try {
        foreach ($entry in $Environment.GetEnumerator()) {
            $previousValues[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
        }

        return Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
    }
    finally {
        foreach ($entry in $previousValues.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
        }
    }
}

function Stop-StartedProcesses {
    param([System.Diagnostics.Process[]]$Processes)

    foreach ($process in $Processes) {
        if ($null -ne $process -and -not $process.HasExited) {
            # /T limits cleanup to descendants of this invocation's tracked PID.
            & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
            if (-not $process.HasExited) {
                Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
            }
        }
    }
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][System.Diagnostics.Process]$Process,
        [Parameter(Mandatory)][int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if ($Process.HasExited) {
            throw "Process PID $($Process.Id) exited before $Uri became available."
        }

        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return
            }
        }
        catch {
            # Startup races are expected until the bounded deadline is reached.
        }

        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    if ($Process.HasExited) {
        throw "Process PID $($Process.Id) exited before $Uri became available."
    }

    throw "Timed out after $TimeoutSeconds seconds waiting for $Uri."
}

if (-not (Test-Path -LiteralPath $backendPath) -or -not (Test-Path -LiteralPath $frontendPath)) {
    throw 'The expected backend and frontend directories are missing from this repository checkout.'
}

$virtualEnvironmentPython = Join-Path $backendPath '.venv\Scripts\python.exe'
$pythonPath = if ($PythonPath) {
    (Resolve-Path -LiteralPath $PythonPath).Path
}
elseif (Test-Path -LiteralPath $virtualEnvironmentPython) {
    $virtualEnvironmentPython
}
else {
    (Get-RequiredCommand -Name 'python').Source
}
$null = Get-RequiredCommand -Name 'node'
$npm = Get-RequiredCommand -Name 'npm'

if (-not (Test-Path -LiteralPath (Join-Path $frontendPath 'node_modules'))) {
    throw 'Frontend dependencies are not installed. Run "npm ci" in the frontend directory first.'
}

& $pythonPath -c 'import fastapi, uvicorn'
if ($LASTEXITCODE -ne 0) {
    throw 'Backend dependencies are not installed for this Python interpreter. Run "pip install -e .[dev]" in the backend directory first.'
}

foreach ($port in 8000, 5173) {
    if (Test-LocalPortInUse -Port $port) {
        throw "Port $port is already in use. The launcher will not stop an existing process; close the process using that port and try again."
    }
}

$startedProcesses = @()
try {
    $backendProcess = Start-ProcessWithEnvironment -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $backendPath -Environment @{
        CORS_ORIGINS = '["http://localhost:5173"]'
    }
    $startedProcesses += $backendProcess
    Wait-HttpReady -Uri $backendHealthUrl -Process $backendProcess -TimeoutSeconds $StartupTimeoutSeconds

    $frontendProcess = Start-ProcessWithEnvironment -FilePath $npm.Source -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $frontendPath -Environment @{
        VITE_DATA_SOURCE = 'api'
        VITE_BACKEND_URL = 'http://localhost:8000'
    }
    $startedProcesses += $frontendProcess
    Wait-HttpReady -Uri $frontendUrl -Process $frontendProcess -TimeoutSeconds $StartupTimeoutSeconds
}
catch {
    Stop-StartedProcesses -Processes $startedProcesses
    throw
}

Write-Output "Frontend browser URL: $frontendUrl"
Write-Output "Backend health check: $backendHealthUrl"
Write-Output "Started backend PID $($backendProcess.Id) and frontend PID $($frontendProcess.Id)."
Write-Output 'To stop this MVP, close the two processes above or stop their terminal-hosted child processes by PID.'

if (-not $NoBrowser) {
    Start-Process $frontendUrl
}
