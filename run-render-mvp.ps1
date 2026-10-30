$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'render-mvp'
Set-Location -Path $project

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '       KHADSETU RENDER MVP (LOCAL)' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green

$nodeVersionText = (node --version).Trim().TrimStart('v')
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]'24.22.1' -or $nodeVersion -ge [version]'25.0.0') {
    throw "Node.js 24.22.1.x is required. Detected $nodeVersionText."
}

if (-not (Test-Path (Join-Path $project 'node_modules'))) {
    Write-Host 'Installing demo dependencies...' -ForegroundColor Yellow
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
}

Write-Host 'Starting standalone KhadSetu demo at http://localhost:3000' -ForegroundColor Green
Write-Host 'OCR runs in the browser. First OCR use needs internet to fetch language data.' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop.' -ForegroundColor DarkGray
npm run dev
if ($LASTEXITCODE -ne 0) { throw 'KhadSetu stopped with an error.' }
