$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '       KHADSETU DEVELOPMENT LAUNCHER' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green

try {
    $nodeVersionText = (node --version).Trim().TrimStart('v')
    $nodeVersion = [version]$nodeVersionText
} catch {
    throw 'Node.js 24.22.1 or newer is required. Install Node.js and reopen PowerShell.'
}

$requiredNode = [version]'24.22.1'
if ($nodeVersion -lt $requiredNode) {
    throw "Node.js $requiredNode or newer is required. Detected $nodeVersion. Update Node.js, then rerun this script."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm was not found. Reinstall Node.js with npm enabled, then reopen PowerShell.'
}

$envFile = Join-Path $PSScriptRoot '.env.local'
if (-not (Test-Path $envFile)) {
    throw @'
Missing .env.local. This project uses Figma-managed Payload persistence.
The ZIP does not include platform credentials. Copy the required FIGMA_CONTENT_API_*
and FIGMA_OAUTH_* values from your authorized Figma Make environment into .env.local.
Do not paste secrets into chat or commit .env.local to Git.
'@
}

$envLines = Get-Content $envFile
$requiredNames = @(
    'FIGMA_CONTENT_API_CONTENT_SYSTEM_ID',
    'FIGMA_CONTENT_API_URL'
)
$missing = @()
foreach ($name in $requiredNames) {
    $found = $envLines | Where-Object { $_ -match "^$name=.+" } | Select-Object -First 1
    if (-not $found) { $missing += $name }
}
if ($missing.Count -gt 0) {
    throw "Missing required Figma environment values in .env.local: $($missing -join ', '). The managed Payload backend cannot start without them."
}

Write-Host 'Installing and resolving project dependencies...' -ForegroundColor Yellow
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install failed. Review the error above.' }

Write-Host ''
Write-Host 'Starting KhadSetu at http://localhost:3000' -ForegroundColor Green
Write-Host 'Farmer workspace: http://localhost:3000/farmer' -ForegroundColor Cyan
Write-Host 'Operator workspace: http://localhost:3000/operator' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor DarkGray
Write-Host ''

npm run dev
if ($LASTEXITCODE -ne 0) {
    throw 'KhadSetu stopped with an error. Copy the final 30 PowerShell lines for diagnosis.'
}
