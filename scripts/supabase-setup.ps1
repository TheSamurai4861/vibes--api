# Connect Supabase, create/link project, push schema, write .env (+ optional Render)
param(
    [string]$AccessToken,
    [string]$ProjectName = "vibes-music-api",
    [string]$Region = "eu-west-1",
    [string]$DbPassword,
    [switch]$SkipRender,
    [switch]$UseExistingProject,
    [string]$ProjectRef
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_render-common.ps1"

$ProjectRoot = $Script:ProjectRoot
$EnvFile = Join-Path $ProjectRoot ".env"

function Get-SupabaseToken {
    if ($AccessToken) { return $AccessToken.Trim() }
    if ($env:SUPABASE_ACCESS_TOKEN) { return $env:SUPABASE_ACCESS_TOKEN.Trim() }
    $localEnv = Join-Path $ProjectRoot ".env.supabase.local"
    if (Test-Path $localEnv) {
        foreach ($line in Get-Content $localEnv) {
            if ($line -match '^\s*SUPABASE_ACCESS_TOKEN=(.+)$') {
                return $matches[1].Trim()
            }
        }
    }
    return $null
}

function Invoke-SupabaseApi {
    param([string]$Method, [string]$Path, $Body = $null)
    $headers = @{
        Authorization = "Bearer $SupabaseToken"
        Accept        = "application/json"
    }
    $uri = "https://api.supabase.com/v1$Path"
    if ($null -ne $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json) -ContentType "application/json"
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Write-EnvFile {
    param([string]$Url, [string]$Anon, [string]$Service)
    $lines = @()
    if (Test-Path $EnvFile) {
        $lines = @(Get-Content $EnvFile | Where-Object {
            $_ -notmatch '^\s*SUPABASE_(URL|ANON_KEY|SERVICE_ROLE_KEY)='
        })
    }
    $lines += "SUPABASE_URL=$Url"
    $lines += "SUPABASE_ANON_KEY=$Anon"
    $lines += "SUPABASE_SERVICE_ROLE_KEY=$Service"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($EnvFile, $lines, $utf8)
    Write-Host ".env updated with Supabase keys" -ForegroundColor Green
}

$SupabaseToken = Get-SupabaseToken
if (-not $SupabaseToken) {
    Write-Host "Token requis: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..." ; npm run supabase:setup' -ForegroundColor Cyan
    exit 1
}

Write-Host "Connexion CLI Supabase..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    npx supabase login --token "$SupabaseToken" 2>&1 | Out-Host
    $loginCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($loginCode -ne 0) { throw "supabase login failed" }

    $ref = $ProjectRef
    if (-not $ref) {
        if ($UseExistingProject) {
            $projects = npx supabase projects list -o json 2>&1 | Out-String | ConvertFrom-Json
            $match = $projects | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1
            if (-not $match) {
                $match = $projects | Select-Object -First 1
                Write-Host "Projet $ProjectName introuvable, utilisation de $($match.name)" -ForegroundColor Yellow
            }
            $ref = $match.id
        }
        else {
            $existing = @()
            try {
                $existing = @(Invoke-SupabaseApi -Method GET -Path "/projects")
            }
            catch {
                Write-Host "Liste projets API: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            $found = $existing | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1
            if ($found) {
                $ref = $found.id
                Write-Host "Projet existant: $ProjectName ($ref)" -ForegroundColor Green
            }
            else {
                if (-not $DbPassword) {
                    $DbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
                    Write-Host "Mot de passe DB genere (voir dashboard Supabase)." -ForegroundColor Yellow
                }
                $orgs = @(Invoke-SupabaseApi -Method GET -Path "/organizations")
                if ($orgs.Count -eq 0) {
                    throw "Aucune organisation Supabase sur ce compte."
                }
                $orgId = $orgs[0].id
                Write-Host "Creation du projet $ProjectName (org $($orgs[0].name))..." -ForegroundColor Cyan
                $created = Invoke-SupabaseApi -Method POST -Path "/projects" -Body @{
                    organization_id = $orgId
                    name            = $ProjectName
                    region          = $Region
                    db_pass         = $DbPassword
                }
                $ref = $created.id
                Write-Host "Projet cree: $ref - attente provisioning..." -ForegroundColor Green
                $deadline = (Get-Date).AddMinutes(5)
                $p = $null
                do {
                    Start-Sleep -Seconds 15
                    $p = Invoke-SupabaseApi -Method GET -Path "/projects/$ref"
                    Write-Host "  status: $($p.status)"
                } while ($p.status -ne "ACTIVE_HEALTHY" -and (Get-Date) -lt $deadline)
                if ($p.status -ne "ACTIVE_HEALTHY") {
                    throw "Projet pas pret (status=$($p.status)). Relancez avec -ProjectRef $ref -UseExistingProject"
                }
            }
        }
    }

    Write-Host "Link project $ref ..." -ForegroundColor Cyan
    $ErrorActionPreference = 'Continue'
    npx supabase link --project-ref $ref 2>&1 | Out-Host
    Write-Host "Push migration SQL..." -ForegroundColor Cyan
    npx supabase db push 2>&1 | Out-Host
    $pushCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($pushCode -ne 0) {
        Write-Host "db push echoue - executer 001_initial.sql dans SQL Editor." -ForegroundColor Yellow
    }

    $keys = @(Invoke-SupabaseApi -Method GET -Path "/projects/$ref/api-keys")
    $anonRow = $keys | Where-Object { $_.name -eq "anon" -and $_.type -eq "legacy" } | Select-Object -First 1
    $serviceRow = $keys | Where-Object { $_.name -eq "service_role" -and $_.type -eq "legacy" } | Select-Object -First 1
    $anon = $anonRow.api_key
    $service = $serviceRow.api_key
    if (-not $anon -or -not $service) {
        throw "Could not find legacy anon/service_role API keys"
    }
    $project = Invoke-SupabaseApi -Method GET -Path "/projects/$ref"
    $url = "https://$($project.ref).supabase.co"
    if ($project.endpoint) { $url = $project.endpoint }

    Write-EnvFile -Url $url -Anon $anon -Service $service

    @{
        projectRef = $ref
        url        = $url
        name       = $ProjectName
    } | ConvertTo-Json | Set-Content (Join-Path $ProjectRoot ".supabase-state.json") -Encoding UTF8

    if (-not $SkipRender -and $env:RENDER_API_KEY) {
        $state = Get-RenderState
        if ($state -and $state.serviceId) {
            Write-Host "Mise a jour variables Render..." -ForegroundColor Cyan
            & "$PSScriptRoot\render-supabase-env.ps1" -ServiceId $state.serviceId `
                -SupabaseUrl $url -AnonKey $anon -ServiceRoleKey $service
        }
    }
    elseif (-not $SkipRender) {
        Write-Host "RENDER_API_KEY absent - ajoutez Supabase sur Render manuellement." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Supabase OK - projet $ref" -ForegroundColor Green
    Write-Host "  URL: $url"
    Write-Host "  Test: npm start puis POST /auth/register"
}
finally {
    Pop-Location
}
