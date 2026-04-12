$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root "clan-salamanca-release.zip"

Write-Host "Packaging release (without node_modules/dist/uploads)..." -ForegroundColor Cyan

if (Test-Path $out) { Remove-Item $out -Force }

$exclude = @(
  "\frontend\node_modules\",
  "\backend\node_modules\",
  "\frontend\dist\",
  "\backend\dist\",
  "\backend\uploads\",
  "\.cursor\",
  "\.git\"
)

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
  $full = $_.FullName
  foreach ($e in $exclude) {
    if ($full -like "*$e*") { return $false }
  }
  return $true
}

if (-not $files) {
  throw "No files found to package."
}

Compress-Archive -Path $files.FullName -DestinationPath $out -CompressionLevel Optimal

Write-Host "Done: $out" -ForegroundColor Green
Write-Host "Note: node_modules and uploads are excluded." -ForegroundColor DarkGray

