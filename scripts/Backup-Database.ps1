param(
    [string]$ComposeFile = (Join-Path $PSScriptRoot '../compose.yaml'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../.local/backups'),
    [string]$EnvironmentFile
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Compose-Arguments.ps1')
$composeArguments = Get-ComposeArguments $ComposeFile $EnvironmentFile
$directory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$id = [Guid]::NewGuid().ToString('N')
$name = 'easyback-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $id.Substring(0,8) + '.dump'
$remote = '/tmp/easyback-' + $id + '.dump'
$container = (& docker @composeArguments ps -q postgres).Trim()
if ($LASTEXITCODE -ne 0 -or !$container) { throw 'Running postgres service not found.' }
try {
    & docker @composeArguments exec -T postgres pg_dump -U easyback -d easyback --format=custom --file=$remote
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
    $target = Join-Path $directory $name
    & docker cp "${container}:$remote" $target
    if ($LASTEXITCODE -ne 0) { throw 'Copying backup failed.' }
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    [ordered]@{ filename=$name; sha256=$hash; createdAtUtc=[DateTime]::UtcNow.ToString('o'); database='easyback'; format='PostgreSQL custom'; encrypted=$false } |
        ConvertTo-Json | Set-Content -LiteralPath ($target + '.json') -Encoding UTF8
    Write-Output $target
} finally {
    & docker @composeArguments exec -T postgres rm -f $remote | Out-Null
}
