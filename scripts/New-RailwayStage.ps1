[CmdletBinding()]
param([string]$SourceRoot = (Split-Path -Parent $PSScriptRoot))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-NoReparsePoint([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse points are forbidden: $($item.FullName)"
        }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory }
        else { $item = $item.Parent }
    }
}

$root = (Get-Item -LiteralPath $SourceRoot -Force).FullName.TrimEnd([IO.Path]::DirectorySeparatorChar)
if (!(Test-Path -LiteralPath $root -PathType Container)) { throw 'SourceRoot must be a directory.' }
Assert-NoReparsePoint $root
$prefix = $root + [IO.Path]::DirectorySeparatorChar
$files = [Collections.Generic.SortedDictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)

function Add-ReviewedFile([IO.FileInfo]$File) {
    if (!$File.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source escaped project root.' }
    $relative = $File.FullName.Substring($prefix.Length).Replace('\', '/')
    if (($File.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $relative" }
    if ($relative -match '(?i)(^|/)(\.env[^/]*|[^/]*\.env(?:\.[^/]*)?|backups?|dumps?|secrets?|private|credentials?)(/|$)' -or
        $relative -match '(?i)(secret|credential|id_rsa|id_ed25519|pgpass)' -or
        $relative -match '(?i)\.(dump|backup|bak|pem|key|p12|pfx|jks|keystore|zip|tar|gz|7z)(\.|$)') {
        throw "Forbidden private/environment/archive file: $relative"
    }
    $allowed = $relative -in @('Dockerfile.Railway', 'railway.json', '.dockerignore', '.gitignore',
        'backendjava/pom.xml', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/index.html',
        'frontend/tsconfig.json', 'frontend/vite.config.ts', 'frontend/public/brand-mark.svg') -or
        $relative -match '^backendjava/src/main/java/(?:[A-Za-z0-9_]+/)*[A-Za-z0-9_]+\.java$' -or
        $relative -match '^backendjava/src/main/resources/application(?:-railway)?\.yml$' -or
        $relative -match '^backendjava/src/main/resources/db/migration/V[0-9]+__[A-Za-z0-9_]+\.sql$' -or
        $relative -match '^frontend/src/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.(ts|tsx|css)$'
    if (!$allowed) { throw "Unreviewed input (extend the allowlist only after review): $relative" }
    $files.Add($relative, $File.FullName)
}

function Add-ReviewedTree([string]$Path) {
    Assert-NoReparsePoint $Path
    foreach ($item in Get-ChildItem -LiteralPath $Path -Force) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $($item.FullName)" }
        if ($item.PSIsContainer) { Add-ReviewedTree $item.FullName }
        else { Add-ReviewedFile $item }
    }
}

# Validate every selected input before creating or copying anything.
foreach ($relative in @('Dockerfile.Railway', 'railway.json', '.dockerignore', '.gitignore', 'backendjava/pom.xml',
    'frontend/package.json', 'frontend/package-lock.json', 'frontend/index.html', 'frontend/tsconfig.json', 'frontend/vite.config.ts')) {
    $path = Join-Path $root $relative
    Assert-NoReparsePoint $path
    Add-ReviewedFile (Get-Item -LiteralPath $path -Force)
}
foreach ($relative in @('backendjava/src/main', 'frontend/src', 'frontend/public')) {
    Add-ReviewedTree (Join-Path $root $relative)
}

$local = Join-Path $root '.local'
if (Test-Path -LiteralPath $local) { Assert-NoReparsePoint $local }
else { New-Item -ItemType Directory -Path $local | Out-Null }
$stage = Join-Path $local ('railway-stage-' + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $stage) { throw 'Staging directory must be new.' }
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($entry in $files.GetEnumerator()) {
    # Recheck link ancestry just before copy; no recursive Copy-Item/upload is used.
    Assert-NoReparsePoint $entry.Value
    $target = Join-Path $stage $entry.Key
    $parent = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Assert-NoReparsePoint $parent
    Copy-Item -LiteralPath $entry.Value -Destination $target
}
[IO.File]::WriteAllLines((Join-Path $stage 'MANIFEST.txt'), [string[]]$files.Keys, [Text.UTF8Encoding]::new($false))
# Only the local stage path is emitted. No secrets, hashes, contents or upload action.
Write-Output $stage
