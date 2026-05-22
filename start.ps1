# start.ps1 — Game Ledger dev launcher
# Usage: .\start.ps1

$Root = $PSScriptRoot

$tsx   = Join-Path $Root "server\node_modules\tsx\dist\cli.mjs"
$entry = Join-Path $Root "server\src\index.ts"
$vite  = Join-Path $Root "client\node_modules\vite\bin\vite.js"

Write-Host "`nGame Ledger — dev start`n" -ForegroundColor Cyan

# ── 1. Skip if :3001 already occupied ────────────────────────────────────────
$alreadyUp = $false
try {
    $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", 3001); $c.Close()
    $alreadyUp = $true
    Write-Host "Server already running on :3001 — skipping launch`n" -ForegroundColor Yellow
} catch { }

if (-not $alreadyUp) {
    # ── 2. Write server launcher to a temp file (no quoting issues) ───────────
    $tmp = Join-Path $env:TEMP "game-ledger-server.ps1"
    @"
Write-Host 'Game Ledger — API Server' -ForegroundColor Cyan
node '$tsx' '$entry'
"@ | Out-File -FilePath $tmp -Encoding utf8

    Write-Host "Starting API server..." -ForegroundColor DarkGray
    Start-Process powershell -ArgumentList "-NoExit", "-File", $tmp

    # ── 3. Poll :3001 until ready (max 15 s) ──────────────────────────────────
    Write-Host "Waiting for API" -NoNewline -ForegroundColor DarkGray
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        try {
            $c = New-Object Net.Sockets.TcpClient; $c.Connect("127.0.0.1", 3001); $c.Close()
            $ready = $true; break
        } catch { }
    }
    Write-Host ""
    if ($ready) { Write-Host "API ready!`n"                          -ForegroundColor Green  }
    else         { Write-Host "API timed out — starting Vite anyway`n" -ForegroundColor Yellow }
}

# ── 4. Run Vite in this window ────────────────────────────────────────────────
Write-Host "Vite → http://localhost:5173" -ForegroundColor Green
Write-Host "(Close the server window to stop the API)`n" -ForegroundColor DarkGray
& node $vite
