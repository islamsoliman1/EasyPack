param([int]$Port = 5173)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $workspace 'frontend'
$logs = Join-Path $workspace '.local'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$chosen = $null
for ($candidate = $Port; $candidate -lt ($Port + 10); $candidate++) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate)
    try { $listener.Start(); $chosen = $candidate; break } catch [Net.Sockets.SocketException] {} finally { $listener.Stop() }
}
if ($null -eq $chosen) { throw 'No free frontend port found.' }
$node = (Get-Command node).Source
$process = Start-Process -FilePath $node -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', $chosen, '--strictPort') -WorkingDirectory $frontend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "frontend-$chosen.stdout.log") -RedirectStandardError (Join-Path $logs "frontend-$chosen.stderr.log")
Write-Output "Frontend starting at http://localhost:$chosen (PID $($process.Id)). Logs: .local/"
