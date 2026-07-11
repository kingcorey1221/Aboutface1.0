param(
  [string]$InstallDir = ".models\FasterLivePortrait"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$target = Join-Path $root $InstallDir

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required to install FasterLivePortrait."
}

if (-not (Test-Path $target)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  git clone https://github.com/warmshao/FasterLivePortrait $target
} else {
  git -C $target pull
}

Push-Location $target
try {
  python -m venv .venv
  & .\.venv\Scripts\python.exe -m pip install --upgrade pip
  & .\.venv\Scripts\python.exe -m pip install -r requirements_win.txt
  & .\.venv\Scripts\python.exe -m pip install "huggingface_hub[cli]"
  & .\.venv\Scripts\huggingface-cli.exe download warmshao/FasterLivePortrait --local-dir .\checkpoints
} finally {
  Pop-Location
}

Write-Output "FasterLivePortrait installed at $target"
Write-Output "Run scripts\run-faster-liveportrait-api.ps1 next."
