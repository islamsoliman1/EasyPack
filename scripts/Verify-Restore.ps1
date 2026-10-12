param(
    [Parameter(Mandatory=$true)][string]$BackupFile,
    [string]$ComposeFile = (Join-Path $PSScriptRoot '../compose.yaml'),
    [ValidatePattern('^[a-z][a-z0-9_]{0,62}$')][string]$DatabaseAdmin = 'easyback',
    [string]$EnvironmentFile
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Compose-Arguments.ps1')
$composeArguments = Get-ComposeArguments $ComposeFile $EnvironmentFile
$backup = (Resolve-Path -LiteralPath $BackupFile).Path
$manifest = Get-Content -LiteralPath ($backup + '.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Backup checksum mismatch.' }
$container = (& docker @composeArguments ps -q postgres).Trim()
if ($LASTEXITCODE -ne 0 -or !$container) { throw 'Running postgres service not found.' }
$id = [Guid]::NewGuid().ToString('N')
$database = 'easyback_restore_check_' + $id
if ($database -notmatch '^easyback_restore_check_[a-f0-9]{32}$') { throw 'Unsafe verification database name.' }
$remote = '/tmp/restore-' + $id + '.dump'
$created = $false
try {
    & docker cp $backup "${container}:$remote"
    if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed.' }
    & docker @composeArguments exec -T postgres createdb -U $DatabaseAdmin --owner=easyback $database
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated verification database.' }
    $created = $true
    & docker @composeArguments exec -T postgres pg_restore -U $DatabaseAdmin --role=easyback --no-owner --exit-on-error --dbname=$database $remote
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed.' }
    $sql = 'DO $$ BEGIN IF EXISTS(SELECT 1 FROM resource_files WHERE octet_length(content)<>size_bytes OR encode(sha256(content),''hex'')<>sha256) THEN RAISE EXCEPTION ''Attachment integrity failed''; END IF; END $$; SELECT max(version::int) AS schema_version FROM flyway_schema_history WHERE success; SELECT count(*) AS attachments_restored FROM resource_files; SELECT count(*) AS orders_restored FROM manufacturing_orders;'
    & docker @composeArguments exec -T postgres psql -U easyback -d $database -v ON_ERROR_STOP=1 -c $sql
    if ($LASTEXITCODE -ne 0) { throw 'Verification queries failed.' }
    Write-Output 'Restore verified in a newly created disposable database; live database was not replaced.'
} finally {
    if ($created) { & docker @composeArguments exec -T postgres dropdb -U $DatabaseAdmin $database | Out-Null }
    & docker @composeArguments exec -T postgres rm -f $remote | Out-Null
}
