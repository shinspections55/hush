# start-and-open.ps1
# Helper: install dependencies (if needed), start server, wait for it to be ready, then open default browser
# Usage: .\start-and-open.ps1

$projectRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location $projectRoot

# Ensure node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found in PATH. Please install Node.js LTS from https://nodejs.org/ and re-run this script." -ForegroundColor Yellow
    exit 1
}

# Install dependencies if node_modules missing
if (-not (Test-Path "$projectRoot\node_modules")) {
    Write-Host "Installing npm dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed." -ForegroundColor Red; exit 1 }
}

# Start server as a background job and capture output
Write-Host "Starting server..."
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "npm"
$startInfo.Arguments = "start"
$startInfo.WorkingDirectory = $projectRoot
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$null = $process.Start()

$reader = $process.StandardOutput
$errReader = $process.StandardError

$timeout = [DateTime]::UtcNow.AddSeconds(20)
$opened = $false

while (-not $process.HasExited -and [DateTime]::UtcNow -lt $timeout) {
    Start-Sleep -Milliseconds 200
    while (-not $reader.EndOfStream) {
        $line = $reader.ReadLine()
        Write-Host $line
        if (-not $opened -and $line -match "Server listening on http://localhost:(\d+)") {
            $port = $Matches[1]
            $url = "http://localhost:$port"
            Write-Host "Opening browser to $url"
            Start-Process $url
            $opened = $true
        }
    }
    while (-not $errReader.EndOfStream) {
        $eline = $errReader.ReadLine()
        Write-Host $eline -ForegroundColor Red
    }
}

if (-not $opened) {
    # fallback: open default port 8000
    $url = "http://localhost:8000"
    Write-Host "Did not detect ready log. Opening default $url"
    Start-Process $url
}

Write-Host "Server process is running (PID: $($process.Id)). To stop it, close this PowerShell session or kill the process."
