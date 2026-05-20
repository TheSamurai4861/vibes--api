# Push Supabase env vars to Render service
param(
    [string]$ServiceId,
    [string]$SupabaseUrl,
    [string]$AnonKey,
    [string]$ServiceRoleKey
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_render-common.ps1"

if (-not $env:RENDER_API_KEY) {
    $cliYaml = Join-Path $env:USERPROFILE ".render\cli.yaml"
    if (Test-Path $cliYaml) {
        $m = Get-Content $cliYaml -Raw | Select-String -Pattern 'key:\s*(rnd_\S+)'
        if ($m) { $env:RENDER_API_KEY = $m.Matches[0].Groups[1].Value }
    }
}
if (-not $env:RENDER_API_KEY) {
    throw "RENDER_API_KEY required (or run render login)"
}

$state = Get-RenderState
if (-not $ServiceId -and $state -and $state.serviceId) {
    $ServiceId = $state.serviceId
}
if (-not $ServiceId) {
    throw "Provide -ServiceId or run render-setup.ps1 first"
}

$EnvFile = Join-Path $Script:ProjectRoot ".env"
if (-not $SupabaseUrl -and (Test-Path $EnvFile)) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*SUPABASE_URL=(.+)$') { $SupabaseUrl = $matches[1].Trim() }
        if ($line -match '^\s*SUPABASE_ANON_KEY=(.+)$') { $AnonKey = $matches[1].Trim() }
        if ($line -match '^\s*SUPABASE_SERVICE_ROLE_KEY=(.+)$') { $ServiceRoleKey = $matches[1].Trim() }
    }
}

if (-not $SupabaseUrl -or -not $AnonKey -or -not $ServiceRoleKey) {
    throw "Provide SupabaseUrl, AnonKey, ServiceRoleKey or run supabase-setup.ps1 first"
}

$headers = @{
    Authorization  = "Bearer $($env:RENDER_API_KEY)"
    "Content-Type" = "application/json"
    Accept         = "application/json"
}

$uri = "https://api.render.com/v1/services/$ServiceId/env-vars"
$existing = @()
try {
    $existing = @(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)
} catch {
    Write-Host "Could not list existing env vars; sending Supabase keys only." -ForegroundColor Yellow
}

$map = @{}
$preserveKeys = @('NODE_VERSION')
foreach ($item in $existing) {
    if (-not $item.envVar) { continue }
    $key = $item.envVar.key
    if ($preserveKeys -contains $key) {
        $map[$key] = $item.envVar.value
    }
}
$map['SUPABASE_URL'] = $SupabaseUrl
$map['SUPABASE_ANON_KEY'] = $AnonKey
$map['SUPABASE_SERVICE_ROLE_KEY'] = $ServiceRoleKey

if ($state -and $state.adminToken) {
    $map['ADMIN_TOKEN'] = $state.adminToken
}
if ($state -and $state.url) {
    $map['CORS_ORIGIN'] = $state.url
}
$map['CACHE_MEMORY_ONLY'] = '1'
$map['DEEZER_COUNTRY'] = 'FR'
$map['RENDER'] = 'true'

if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*ADMIN_TOKEN=(.+)$') { $map['ADMIN_TOKEN'] = $matches[1].Trim() }
        if ($line -match '^\s*DEEZER_COUNTRY=(.+)$') { $map['DEEZER_COUNTRY'] = $matches[1].Trim() }
    }
}

$body = @(
    $map.GetEnumerator() | ForEach-Object {
        @{ key = $_.Key; value = [string]$_.Value }
    }
) | ConvertTo-Json -Depth 4

Write-Host "Updating Render env on $ServiceId ..."
Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Write-Host "Render env updated (Supabase + core vars)." -ForegroundColor Green

$render = Get-RenderExe
Write-Host "Triggering redeploy..."
& $render deploys create $ServiceId --confirm -o json | Out-Host
