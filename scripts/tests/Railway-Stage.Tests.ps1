Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $project 'scripts/New-RailwayStage.ps1'
$testRoot = Join-Path $project ('.local/railway-stage-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$linked = $null
$linkedLocal = $null
$linkedRoot = $null

function Write-Fixture([string]$Root, [string]$Relative, [string]$Content = 'test-only fixture') {
    $path = Join-Path $Root $Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $path) -Force | Out-Null
    [IO.File]::WriteAllText($path, $Content)
}
function New-Fixture {
    $root = Join-Path $testRoot ([Guid]::NewGuid().ToString('N'))
    foreach ($file in @('Dockerfile.Railway', 'railway.json', '.dockerignore', '.gitignore', 'backendjava/pom.xml',
        'backendjava/src/main/java/com/example/App.java', 'backendjava/src/main/resources/application.yml',
        'backendjava/src/main/resources/application-railway.yml', 'backendjava/src/main/resources/db/migration/V1__schema.sql',
        'frontend/package.json', 'frontend/package-lock.json', 'frontend/index.html', 'frontend/tsconfig.json',
        'frontend/vite.config.ts', 'frontend/src/main.tsx', 'frontend/public/brand-mark.svg')) {
        Write-Fixture $root $file
    }
    return $root
}
function Assert-True([bool]$Value, [string]$Message) { if (!$Value) { throw $Message } }
function Assert-Rejected([scriptblock]$Action) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Assert-True $failed 'Unsafe fixture was not rejected.'
}

try {
    $root = New-Fixture
    Write-Fixture $root '.env' 'not a real secret'
    Write-Fixture $root 'backups/company.dump' 'not a real dump'
    Write-Fixture $root 'frontend/test-results/private.txt'
    $first = & $script -SourceRoot $root
    $second = & $script -SourceRoot $root
    Assert-True ($first -ne $second) 'Stages were not unique.'
    Assert-True ($first.StartsWith((Join-Path $root '.local'), [StringComparison]::OrdinalIgnoreCase)) 'Stage escaped .local.'
    $manifest = @(Get-Content -LiteralPath (Join-Path $first 'MANIFEST.txt'))
    Assert-True ($manifest.Count -eq 16) 'Unexpected manifest size.'
    Assert-True ($manifest -contains 'backendjava/src/main/resources/db/migration/V1__schema.sql') 'Schema migration was omitted.'
    Assert-True (@($manifest | Where-Object { $_ -match '(\.env|dump|private|test-results)' }).Count -eq 0) 'Private input was staged.'
    Assert-True (@(Get-ChildItem -LiteralPath $first -Recurse -File -Force).Count -eq ($manifest.Count + 1)) 'Stage differs from manifest.'
    Assert-True (!(Test-Path -LiteralPath (Join-Path $first '.env'))) 'Root environment was copied.'

    foreach ($forbidden in @('frontend/src/.env.production', 'frontend/src/client.env', 'frontend/src/secrets.ts',
        'backendjava/src/main/resources/company.sql', 'backendjava/src/main/resources/db/migration/backup.dump',
        'frontend/public/private.pem', 'frontend/public/unreviewed.svg', 'frontend/src/source.zip')) {
        $fixture = New-Fixture
        Write-Fixture $fixture $forbidden
        Assert-Rejected { & $script -SourceRoot $fixture }
        Assert-True (!(Test-Path -LiteralPath (Join-Path $fixture '.local'))) 'Rejected inputs created a stage.'
    }

    $fixture = New-Fixture
    $linked = Join-Path $fixture 'frontend/src/linked'
    New-Item -ItemType Junction -Path $linked -Target (Join-Path $root 'frontend/src') | Out-Null
    Assert-Rejected { & $script -SourceRoot $fixture }
    Remove-Item -LiteralPath $linked -Force

    $fixture = New-Fixture
    $linkedLocal = Join-Path $fixture '.local'
    New-Item -ItemType Junction -Path $linkedLocal -Target (Join-Path $root '.local') | Out-Null
    Assert-Rejected { & $script -SourceRoot $fixture }
    Remove-Item -LiteralPath $linkedLocal -Force

    $linkedRoot = Join-Path $testRoot 'linked-root'
    New-Item -ItemType Junction -Path $linkedRoot -Target $root | Out-Null
    Assert-Rejected { & $script -SourceRoot $linkedRoot }
    Remove-Item -LiteralPath $linkedRoot -Force
    Write-Output 'Railway staging tests passed: unique allowlisted stages, filenames-only manifest, excluded private roots, forbidden inputs and reparse ancestry.'
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $boundary = [IO.Path]::GetFullPath((Join-Path $project '.local')) + [IO.Path]::DirectorySeparatorChar
    if (!$resolved.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolved) -notlike 'railway-stage-tests-*') { throw 'Unsafe test cleanup path.' }
    # Remove junctions themselves before recursive cleanup, never their targets.
    foreach ($link in @($linked, $linkedLocal, $linkedRoot)) {
        if ($null -ne $link -and (Test-Path -LiteralPath $link)) { Remove-Item -LiteralPath $link -Force }
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
