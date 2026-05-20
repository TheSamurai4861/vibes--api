# Full Render deploy flow: validate, create service, deploy, health check, CORS
param(
    [string]$ServiceName = "music-api",
    [string]$Region = "frankfurt",
    [switch]$SkipCreate,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_render-common.ps1"

Set-Location $ProjectRoot
Ensure-RenderLogin

Write-Host "=== 1. Validate render.yaml ===" -ForegroundColor Cyan
$validateJson = Invoke-Render -Args @("blueprints", "validate", "./render.yaml", "-o", "json", "--confirm") | Out-String
$validate = $validateJson | ConvertFrom-Json
if (-not $validate.valid) {
    Write-Host $validateJson
    $billing = $validate.errors | Where-Object { $_.error -eq "billing_suspended" }
    if ($billing) {
        Write-Host ""
        Write-Host "BLOCKER: Render account billing is suspended." -ForegroundColor Red
        Write-Host "Resolve billing at https://dashboard.render.com/billing then re-run this script."
        exit 2
    }
    throw "render.yaml validation failed."
}
Write-Host "Blueprint valid." -ForegroundColor Green

$adminToken = Get-OrCreateAdminToken
$service = Find-ServiceByName -Name $ServiceName

if (-not $service -and -not $SkipCreate) {
    Write-Host "=== 2. Create web service '$ServiceName' ===" -ForegroundColor Cyan
    try {
        $createJson = Invoke-Render -Args @(
            "services", "create",
            "--name", $ServiceName,
            "--type", "web_service",
            "--repo", $DefaultRepo,
            "--branch", "main",
            "--runtime", "node",
            "--plan", "free",
            "--region", $Region,
            "--build-command", "npm install && npm rebuild sqlite3 --build-from-source",
            "--start-command", "npm start",
            "--health-check-path", "/api/health",
            "--env-var", "NODE_VERSION=20",
            "--env-var", "CACHE_DB_PATH=/tmp/cache.db",
            "--env-var", "ADMIN_TOKEN=$adminToken",
            "--env-var", "CORS_ORIGIN=*",
            "--auto-deploy",
            "-o", "json",
            "--confirm"
        ) | Out-String
        Write-Host $createJson
        $service = Find-ServiceByName -Name $ServiceName
    } catch {
        if ($_.Exception.Message -match "billing|500") {
            Write-Host "Service creation failed (often billing_suspended on free tier)." -ForegroundColor Red
            Write-Host "Use Dashboard: New -> Blueprint -> connect vibes--api repo, then run:"
            Write-Host "  .\scripts\render-env.ps1 -ServiceId srv-XXXX"
            exit 2
        }
        if ($_.Exception.Message -match "unfetchable|invalid.*repository") {
            Write-Host "GitHub repo not accessible from Render." -ForegroundColor Red
            Write-Host "1. https://dashboard.render.com -> Account Settings -> connect GitHub (matteovanderheyden@gmail.com)"
            Write-Host "2. Grant access to TheSamurai4861/vibes--api (repo is private)"
            Write-Host "3. Re-run: npm run render:setup"
            exit 3
        }
        throw
    }
} elseif ($service) {
    Write-Host "Service '$ServiceName' already exists: $($service.id)" -ForegroundColor Green
} else {
    Write-Host "SkipCreate: no service created." -ForegroundColor Yellow
}

if (-not $service) {
    Write-Host "No service to deploy. Exiting." -ForegroundColor Yellow
    exit 1
}

$serviceId = $service.id
$url = Get-ServicePublicUrl -Service $service
Save-RenderState @{
    serviceId   = $serviceId
    serviceName = $ServiceName
    url         = $url
    adminToken  = $adminToken
}

if (-not $SkipDeploy) {
    Write-Host "=== 3. Deploy (wait) ===" -ForegroundColor Cyan
    Invoke-Render -Args @("deploys", "create", $serviceId, "--wait", "-o", "json", "--confirm") | Out-Host
    Start-Sleep -Seconds 5
    $service = Find-ServiceByName -Name $ServiceName
    $url = Get-ServicePublicUrl -Service $service
    if ($url) { Save-RenderState @{ url = $url } }
}

if ($url) {
    Write-Host "=== 4. Set CORS_ORIGIN ===" -ForegroundColor Cyan
    if ($env:RENDER_API_KEY) {
        & "$PSScriptRoot\render-env.ps1" -ServiceId $serviceId -ServiceUrl $url -AdminToken $adminToken
    } else {
        Write-Host "Skip API env update (set RENDER_API_KEY to run render-env.ps1). Using CORS_ORIGIN=* from create." -ForegroundColor Yellow
    }
}

if ($url) {
    Write-Host "=== 5. Health check ===" -ForegroundColor Cyan
    $healthUrl = "$url/api/health"
    $maxAttempts = 12
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 30
            if ($resp.StatusCode -eq 200) {
                Write-Host "Health OK: $healthUrl" -ForegroundColor Green
                break
            }
        } catch {
            Write-Host "Attempt $i/$maxAttempts - waiting (cold start)..."
            Start-Sleep -Seconds 10
        }
        if ($i -eq $maxAttempts) {
            Write-Host "Health check did not pass yet. Try manually: $healthUrl" -ForegroundColor Yellow
        }
    }

    Write-Host "=== 6. Test cache clear ===" -ForegroundColor Cyan
    try {
        $clear = Invoke-WebRequest -Uri "$url/api/cache/clear" -Method POST `
            -Headers @{ Authorization = "Bearer $adminToken" } -UseBasicParsing
        Write-Host "Cache clear: $($clear.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "Cache clear test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done. Service: $serviceId" -ForegroundColor Green
if ($url) { Write-Host "URL: $url" }
Write-Host "ADMIN_TOKEN is in .env.render.local - use it in Cache Manager or curl."
