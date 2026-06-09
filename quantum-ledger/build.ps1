# build.ps1 — packages Quantum Ledger without needing pnpm in PATH
# Usage:
#   .\build.ps1          -> full installer + portable .exe  (output: release/)
#   .\build.ps1 -Dir     -> unpacked directory only (faster, good for testing)

param([switch]$Dir)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Step($label) { Write-Host "`n==> $label" -ForegroundColor Cyan }

# ── 1. Build TypeScript server ────────────────────────────────────────────────
Step "Build server (TypeScript)"
Push-Location "$Root\server"
node .\node_modules\typescript\bin\tsc
Pop-Location

# ── 2. Build React client ─────────────────────────────────────────────────────
Step "Build client (Vite)"
Push-Location "$Root\client"
node .\node_modules\typescript\bin\tsc
node .\node_modules\vite\bin\vite.js build
Pop-Location

# ── 3. Copy server/dist -> electron/server-dist ───────────────────────────────
Step "Prepare electron package"
node "$Root\scripts\prepare-electron.js"

# ── 4. Install electron dependencies ─────────────────────────────────────────
Step "Install electron dependencies"
Push-Location "$Root\electron"
npm install
Pop-Location

# ── 5. Package with electron-builder ─────────────────────────────────────────
Push-Location "$Root\electron"
if ($Dir) {
    Step "Building unpacked directory (quick test)"
    npm run dist:dir
    Write-Host "`nDone! Run: release\win-unpacked\`"Quantum Ledger.exe`"" -ForegroundColor Green
} else {
    Step "Building installer + portable .exe"
    npm run dist
    Write-Host "`nDone! Artifacts in: release\" -ForegroundColor Green
    Get-ChildItem "$Root\release" -Filter "*.exe" | ForEach-Object {
        Write-Host "  $($_.Name)  ($([math]::Round($_.Length/1MB, 1)) MB)" -ForegroundColor White
    }
}
Pop-Location
