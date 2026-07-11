param(
  [string]$InstallDir = ".models\FasterLivePortrait",
  [int]$Port = 9871
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$target = Join-Path $root $InstallDir

if (-not (Test-Path $target)) {
  throw "FasterLivePortrait is not installed. Run scripts\setup-faster-liveportrait.ps1 first."
}

$python = Join-Path $target ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "FasterLivePortrait venv was not found. Run scripts\setup-faster-liveportrait.ps1 again."
}

$env:FLIP_IP = "127.0.0.1"
$env:FLIP_PORT = "$Port"
Push-Location $target
try {
  & $python api.py
} finally {
  Pop-Location
}
