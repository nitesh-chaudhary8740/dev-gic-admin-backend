# read-models-and-db-config.ps1
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$outputFile = Join-Path $root "models-and-db-config-review.txt"

$relativePaths = @(
    "src\models",
    "src\config\database.js",
    "config\database.js",
    "src\app.js",
    "server.js",
    "package.json",
    ".env.example"
)

$results = @()

foreach ($relativePath in $relativePaths) {
    $fullPath = Join-Path $root $relativePath

    if (-not (Test-Path $fullPath)) {
        continue
    }

    if ((Get-Item $fullPath).PSIsContainer) {
        $files = Get-ChildItem -Path $fullPath -File -Recurse |
            Where-Object {
                $_.Extension -in @(".js", ".cjs", ".mjs", ".json")
            }
    }
    else {
        $files = @(Get-Item $fullPath)
    }

    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw

        $relativeFile = $file.FullName.Substring($root.Length).
            TrimStart([char]'\', [char]'/')

        $results += @"
================================================================================
FILE: $relativeFile
================================================================================
$content

"@
    }
}

if ($results.Count -eq 0) {
    throw "Koi matching file nahi mili. Project root check karo."
}

Set-Content -LiteralPath $outputFile -Value ($results -join "`r`n") -Encoding UTF8

Write-Host "Review file created:" -ForegroundColor Green
Write-Host $outputFile -ForegroundColor Cyan
Write-Host ""
Write-Host "Is file ko share karne se pehle secrets check kar lena." -ForegroundColor Yellow