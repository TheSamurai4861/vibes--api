# Update Render environment variables via REST API (CORS_ORIGIN, optional ADMIN_TOKEN)
param(
    [Parameter(Mandatory = $false)]
    [string]$ServiceId,
    [string]$ServiceUrl,
    [string]$AdminToken,
    [string]$CorsOrigin
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_render-common.ps1"

if (-not $env:RENDER_API_KEY) {
    Write-Host "RENDER_API_KEY is required for API env updates." -ForegroundColor Yellow
    Write-Host "Create one at: https://dashboard.render.com/u/settings#api-keys"
    Write-Host "Then: `$env:RENDER_API_KEY='rnd_...' or add to .env.render.local"
    exit 1
}

$state = Get-RenderState
if (-not $ServiceId) {
    if ($state -and $state.serviceId) { $ServiceId = $state.serviceId }
    else { throw "Provide -ServiceId or run render-setup.ps1 first." }
}

if (-not $ServiceUrl -and $state -and $state.url) {
    $ServiceUrl = $state.url
}

if (-not $CorsOrigin -and $ServiceUrl) {
    $CorsOrigin = $ServiceUrl
}

if (-not $CorsOrigin) {
    throw "Provide -CorsOrigin or -ServiceUrl"
}

if (-not $AdminToken) {
    $AdminToken = Get-OrCreateAdminToken
}

$headers = @{
    Authorization  = "Bearer $($env:RENDER_API_KEY)"
    "Content-Type" = "application/json"
    Accept         = "application/json"
}

# Render API: PUT env-vars replaces/updates — send key/value pairs
$body = @(
    @{ key = "CORS_ORIGIN"; value = $CorsOrigin }
    @{ key = "ADMIN_TOKEN"; value = $AdminToken }
) | ConvertTo-Json -Depth 4

$uri = "https://api.render.com/v1/services/$ServiceId/env-vars"
Write-Host "Updating env vars on $ServiceId ..."
try {
    Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body $body
    Write-Host "CORS_ORIGIN=$CorsOrigin" -ForegroundColor Green
} catch {
    # Fallback: try array wrapper used by some API versions
    $bodyAlt = @{ envVars = @(
            @{ key = "CORS_ORIGIN"; value = $CorsOrigin }
            @{ key = "ADMIN_TOKEN"; value = $AdminToken }
        ) } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body $bodyAlt
    Write-Host "CORS_ORIGIN=$CorsOrigin (alt body)" -ForegroundColor Green
}

$render = Get-RenderExe
Write-Host "Triggering redeploy..."
& $render deploys create $ServiceId --confirm -o json | Out-Host
