function Get-ComposeArguments {
    param([string]$ComposeFile, [string]$EnvironmentFile)
    $compose = (Resolve-Path -LiteralPath $ComposeFile).Path
    $production = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../deploy/compose.yaml')).Path
    if ($compose -eq $production -and [string]::IsNullOrWhiteSpace($EnvironmentFile)) {
        throw 'Production Compose requires an explicit -EnvironmentFile.'
    }
    $arguments = @('compose')
    if (![string]::IsNullOrWhiteSpace($EnvironmentFile)) {
        $arguments += @('--env-file', (Resolve-Path -LiteralPath $EnvironmentFile).Path)
    }
    return $arguments + @('-f', $compose)
}
