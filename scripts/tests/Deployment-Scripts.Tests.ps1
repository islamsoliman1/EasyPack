$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempRoot ('easyback-script-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$global:EasybackDeploymentScriptMock = @{ calls = [Collections.Generic.List[object]]::new(); failCommand = '' }
function Assert-True($condition, $message) { if (!$condition) { throw $message } }
function Assert-Throws([scriptblock]$action) {
    $thrown = $false
    try { & $action | Out-Null } catch { $thrown = $true }
    Assert-True $thrown 'Expected rejection did not occur.'
}
function docker {
    $global:EasybackDeploymentScriptMock.calls.Add(@($args))
    $global:LASTEXITCODE = 0
    if ($global:EasybackDeploymentScriptMock.failCommand -and $args -contains $global:EasybackDeploymentScriptMock.failCommand) { $global:LASTEXITCODE = 1; return }
    if ($args[0] -eq 'compose' -and $args -contains 'ps') { return 'mock-postgres-container' }
    if ($args[0] -eq 'cp' -and $args[1] -like 'mock-postgres-container:*') {
        [IO.File]::WriteAllBytes($args[2], [byte[]](1,2,3,4))
    }
}
function Assert-ComposeSelection($compose, $environment) {
    $commands = @($global:EasybackDeploymentScriptMock.calls | Where-Object { $_[0] -eq 'compose' })
    Assert-True ($commands.Count -gt 0) 'No mocked Compose commands captured.'
    foreach ($command in $commands) {
        Assert-True ($command[1] -eq '--env-file' -and $command[2] -eq $environment -and $command[3] -eq '-f' -and $command[4] -eq $compose) 'Compose command or cleanup lost explicit absolute environment selection.'
    }
}
Push-Location $testRoot
try {
    $environment = Join-Path $testRoot 'validation.env'
    @('EASYBACK_HOST=factory.test.local','LAN_BIND_IP=192.168.1.10',
      ('DB_PASSWORD=' + ('a' * 24)),('ADMIN_DB_PASSWORD=' + ('b' * 24)),('JWT_SECRET=' + ('c' * 64))) |
        Set-Content -LiteralPath $environment
    $compose = (Resolve-Path (Join-Path $root 'deploy/compose.yaml')).Path
    $backupScript = Join-Path $root 'scripts/Backup-Database.ps1'
    $restoreScript = Join-Path $root 'scripts/Verify-Restore.ps1'
    $preflight = Join-Path $root 'scripts/Test-ProductionConfig.ps1'
    Assert-Throws { & $backupScript -ComposeFile $compose }
    Assert-True ($global:EasybackDeploymentScriptMock.calls.Count -eq 0) 'Missing production environment must fail before Docker.'
    $backup = & $backupScript -ComposeFile $compose -EnvironmentFile './validation.env' -OutputDirectory './backups'
    Assert-ComposeSelection $compose $environment
    $global:EasybackDeploymentScriptMock.calls.Clear()
    & $restoreScript -ComposeFile $compose -EnvironmentFile './validation.env' -BackupFile $backup -DatabaseAdmin easyback_admin | Out-Null
    Assert-ComposeSelection $compose $environment
    Assert-True (@($global:EasybackDeploymentScriptMock.calls | Where-Object { $_ -contains 'dropdb' }).Count -eq 1) 'Restore cleanup did not drop its disposable database.'
    $global:EasybackDeploymentScriptMock.calls.Clear(); $global:EasybackDeploymentScriptMock.failCommand = 'pg_restore'
    Assert-Throws { & $restoreScript -ComposeFile $compose -EnvironmentFile './validation.env' -BackupFile $backup }
    Assert-ComposeSelection $compose $environment
    Assert-True (@($global:EasybackDeploymentScriptMock.calls | Where-Object { $_ -contains 'dropdb' }).Count -eq 1) 'Failure cleanup missed disposable database.'
    Assert-True (@($global:EasybackDeploymentScriptMock.calls | Where-Object { $_ -contains 'rm' }).Count -eq 1) 'Failure cleanup missed temporary dump.'
    $global:EasybackDeploymentScriptMock.calls.Clear(); $global:EasybackDeploymentScriptMock.failCommand = 'pg_dump'
    Assert-Throws { & $backupScript -ComposeFile $compose -EnvironmentFile './validation.env' -OutputDirectory './backups' }
    Assert-ComposeSelection $compose $environment
    Assert-True (@($global:EasybackDeploymentScriptMock.calls | Where-Object { $_ -contains 'rm' }).Count -eq 1) 'Backup failure cleanup missed temporary dump.'
    $global:EasybackDeploymentScriptMock.failCommand = ''; $global:EasybackDeploymentScriptMock.calls.Clear()
    & $preflight -EnvironmentFile './validation.env' | Out-Null
    Assert-ComposeSelection $compose $environment
    $global:EasybackDeploymentScriptMock.calls.Clear()
    Assert-Throws { & $preflight -EnvironmentFile './validation.env' -InitialProvisioning }
    Assert-True ($global:EasybackDeploymentScriptMock.calls.Count -eq 0) 'Initial provisioning must validate bootstrap values before Compose.'
    Add-Content -LiteralPath $environment -Value @('BOOTSTRAP_EMAIL=firstboot@test.local','BOOTSTRAP_PASSWORD=TestOnlyPassword123!')
    & $preflight -EnvironmentFile './validation.env' -InitialProvisioning | Out-Null
    $global:EasybackDeploymentScriptMock.calls.Clear()
    $development = & $backupScript -OutputDirectory './backups'
    Assert-True (@($global:EasybackDeploymentScriptMock.calls | Where-Object { $_ -contains '--env-file' }).Count -eq 0) 'Development defaults unexpectedly require an environment file.'
    Write-Output 'Deployment script mocks passed: different cwd, explicit env on all commands/cleanup, fail-closed production, bootstrap modes, development defaults.'
} finally {
    Remove-Variable -Name EasybackDeploymentScriptMock -Scope Global
    Pop-Location
    $resolved = [IO.Path]::GetFullPath($testRoot)
    if (!$resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'easyback-script-test-*') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
