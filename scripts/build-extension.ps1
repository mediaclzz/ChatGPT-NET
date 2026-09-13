$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'manifest.json'
$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$distPath = Join-Path $projectRoot 'dist'
$packagePath = Join-Path $distPath ("ChatGPT-NET-{0}.zip" -f $manifest.version)
$xpiPath = Join-Path $distPath ("ChatGPT-NET-{0}.xpi" -f $manifest.version)
$stagePath = Join-Path ([System.IO.Path]::GetTempPath()) ("chatgpt-net-build-{0}" -f [guid]::NewGuid().ToString('N'))
$artifactPath = Join-Path $stagePath 'artifacts'

New-Item -ItemType Directory -Force -Path $distPath | Out-Null
New-Item -ItemType Directory -Force -Path $stagePath | Out-Null
New-Item -ItemType Directory -Force -Path $artifactPath | Out-Null
foreach ($path in @($packagePath, $xpiPath)) {
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
}

$runtimeFiles = @('manifest.json', 'background.js', 'icons', 'src')
try {
  foreach ($name in $runtimeFiles) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stagePath -Recurse
  }
  & npx --no-install web-ext build --source-dir $stagePath --artifacts-dir $artifactPath --overwrite-dest
  if ($LASTEXITCODE -ne 0) { throw "web-ext build failed with exit code $LASTEXITCODE" }
  $built = Get-ChildItem -LiteralPath $artifactPath -Filter '*.zip' | Select-Object -First 1
  if (-not $built) { throw 'web-ext did not produce a package' }
  Copy-Item -LiteralPath $built.FullName -Destination $packagePath
  Copy-Item -LiteralPath $built.FullName -Destination $xpiPath
} finally {
  if (Test-Path -LiteralPath $stagePath) { Remove-Item -LiteralPath $stagePath -Recurse -Force }
}
Write-Output $packagePath
Write-Output $xpiPath
