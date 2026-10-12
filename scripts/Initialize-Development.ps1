$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$target = Join-Path $workspace '.env'
if (Test-Path -LiteralPath $target) {
    Write-Output 'Development environment already exists; no credentials changed.'
    exit 0
}
function New-RandomValue([int]$Length) {
    [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes($Length)).ToLowerInvariant()
}
$lines = @(
    ('DB_PASSWORD=' + (New-RandomValue 24)),
    ('JWT_SECRET=' + (New-RandomValue 48)),
    'BOOTSTRAP_EMAIL=admin@easyback.local',
    ('BOOTSTRAP_PASSWORD=Eb!' + (New-RandomValue 16))
)
[IO.File]::WriteAllLines($target, $lines)
Write-Output 'Created .env with unique development credentials. Credentials were not printed.'
