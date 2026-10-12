param([Parameter(Mandatory=$true)][string]$EnvironmentFile, [switch]$InitialProvisioning)
$ErrorActionPreference = 'Stop'
$file = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$values = @{}
foreach ($line in Get-Content -LiteralPath $file) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]]=$Matches[2].Trim() }
}
$required = @('EASYBACK_HOST','LAN_BIND_IP','DB_PASSWORD','ADMIN_DB_PASSWORD','JWT_SECRET')
if ($InitialProvisioning) { $required += @('BOOTSTRAP_EMAIL','BOOTSTRAP_PASSWORD') }
foreach ($name in $required) {
    if (!$values[$name] -or $values[$name] -match 'REPLACE|CHANGE_ME') { throw "Missing production value: $name" }
}
if ($values.JWT_SECRET.Length -lt 64 -or $values.DB_PASSWORD.Length -lt 24 -or $values.ADMIN_DB_PASSWORD.Length -lt 24) { throw 'Production secrets are too short.' }
if ($InitialProvisioning -and ($values.BOOTSTRAP_PASSWORD.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($values.BOOTSTRAP_PASSWORD) -gt 72 -or $values.BOOTSTRAP_EMAIL -notmatch '^[^\s@]+@[^\s@]+$')) { throw 'Initial provisioning requires a valid bootstrap email and a password of at least 12 characters and at most 72 UTF-8 bytes.' }
if ($values.DB_PASSWORD -eq $values.ADMIN_DB_PASSWORD) { throw 'Use separate application and administrator secrets.' }
if ($values.EASYBACK_HOST -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$') { throw 'Invalid application hostname.' }
$ip = [Net.IPAddress]::Parse($values.LAN_BIND_IP).GetAddressBytes()
if ($ip.Length -ne 4 -or !($ip[0] -eq 10 -or ($ip[0] -eq 192 -and $ip[1] -eq 168) -or ($ip[0] -eq 172 -and $ip[1] -ge 16 -and $ip[1] -le 31))) { throw 'Bind HTTPS to a private LAN IPv4 address.' }
$compose = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../deploy/compose.yaml')).Path
& docker compose --env-file $file -f $compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose configuration is invalid.' }
Write-Output 'Configuration passed. VPN/MFA, firewall, DNS, trusted certificates, encrypted off-host backups and power recovery still require an on-site acceptance check.'
