param(
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$ServicesPath = Join-Path $ProjectRoot "src\services"
$ReportPath = Join-Path $ProjectRoot "service-review-report.txt"

if (-not (Test-Path $ServicesPath)) {
    Write-Error "Services folder not found: $ServicesPath"
    exit 1
}

$Files = Get-ChildItem -Path $ServicesPath -Filter "*.js" -File

if (-not $Files) {
    Write-Warning "No JavaScript service files found."
    exit 0
}

$Report = [System.Collections.Generic.List[string]]::new()

$Report.Add("SERVICE LAYER REVIEW")
$Report.Add("====================")
$Report.Add("Project: $ProjectRoot")
$Report.Add("Services: $ServicesPath")
$Report.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$Report.Add("")
$Report.Add("NOTE: Read-only audit. No source files or database were modified.")
$Report.Add("")

$Patterns = @(
    @{
        Name = "Legacy page/menu relation reference"
        Regex = '\b(?:page|pages)\.(?:menuId|languageId)\b|\b(?:menuId|languageId)\s*:\s*(?:data\.)?(?:menuId|languageId)\b'
    },
    @{
        Name = "New page translation relation"
        Regex = '\bmenuTranslationId\b'
    },
    @{
        Name = "Transaction handling"
        Regex = '\bsequelize\.transaction\b|\btransaction\s*:'
    },
    @{
        Name = "Soft-delete filtering"
        Regex = '\bisDeleted\b'
    },
    @{
        Name = "Publish-status filtering"
        Regex = '\bisPublished\b'
    },
    @{
        Name = "Page content handling"
        Regex = '\bcontent\b'
    },
    @{
        Name = "Association/include usage"
        Regex = '\binclude\s*:|\bMenuTranslation\b|\bLanguage\b|\bPage\b|\bMenu\b'
    }
)

foreach ($File in $Files) {
    $Lines = Get-Content -LiteralPath $File.FullName
    $Report.Add("")
    $Report.Add(("FILE: " + $File.Name))
    $Report.Add(("-" * (6 + $File.Name.Length)))

    $RelativePath = $File.FullName.Substring($ProjectRoot.Length).TrimStart('\')
    $Report.Add("Path: $RelativePath")

    foreach ($Pattern in $Patterns) {
        $MatchesFound = @(
            for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
                if ($Lines[$Index] -match $Pattern.Regex) {
                    [PSCustomObject]@{
                        Line = $Index + 1
                        Text = $Lines[$Index].Trim()
                    }
                }
            }
        )

        if ($MatchesFound.Count -gt 0) {
            $Report.Add("")
            $Report.Add("[$($Pattern.Name)]")

            foreach ($MatchItem in $MatchesFound) {
                $Report.Add(
                    "  Line $($MatchItem.Line): $($MatchItem.Text)"
                )
            }
        }
    }

    $Report.Add("")
    $Report.Add("[Method names found]")

    $MethodMatches = [regex]::Matches(
        ($Lines -join "`n"),
        '(?m)^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*async\s*\('
    )

    if ($MethodMatches.Count -gt 0) {
        foreach ($MethodMatch in $MethodMatches) {
            $MethodName = if ($MethodMatch.Groups[1].Success) {
                $MethodMatch.Groups[1].Value
            } else {
                $MethodMatch.Groups[2].Value
            }

            $Report.Add("  $MethodName")
        }
    } else {
        $Report.Add("  No matching named function declarations found.")
    }
}

$Report.Add("")
$Report.Add("====================")
$Report.Add("EXPECTED ARCHITECTURE CHECKLIST")
$Report.Add("====================")
$Report.Add("1. Menu service: create and manage shared logical menus.")
$Report.Add("2. Menu translation service: localized title, URL and language.")
$Report.Add("3. Page service: use menuTranslationId, not direct menuId/languageId.")
$Report.Add("4. Page creation: validate translation and prevent duplicate pages.")
$Report.Add("5. Multi-step writes: use a transaction where operations must succeed together.")
$Report.Add("6. Public queries: filter deleted/unpublished menu, translation, language and page records.")
$Report.Add("7. Delete operations: protect translations with linked pages; define soft-delete policy.")
$Report.Add("8. Validate request fields and handle unique/FK database errors.")
$Report.Add("")
$Report.Add("IMPORTANT: This is a pattern-based review, not a full semantic correctness test.")
$Report.Add("")

$Report | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host ""
Write-Host "Service review completed." -ForegroundColor Green
Write-Host "Files scanned: $($Files.Count)"
Write-Host "Report saved to: $ReportPath"
Write-Host ""
Write-Host "Open the report with:"
Write-Host "notepad `"$ReportPath`""