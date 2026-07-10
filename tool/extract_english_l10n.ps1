param(
  [Parameter(Mandatory = $true)]
  [string]$AppLocalizations,
  [Parameter(Mandatory = $true)]
  [string]$CompactTranslations,
  [Parameter(Mandatory = $true)]
  [string]$OutputJson
)

$ErrorActionPreference = 'Stop'

function Extract-Map([string]$Path, [string]$Language) {
  $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $marker = "'$Language': {"
  $start = $text.IndexOf($marker)
  if ($start -lt 0) { throw "Language $Language not found in $Path" }
  $brace = $text.IndexOf('{', $start)
  $depth = 0
  $inString = $false
  $escaped = $false
  $end = -1
  for ($i = $brace; $i -lt $text.Length; $i++) {
    $char = $text[$i]
    if ($inString) {
      if ($escaped) {
        $escaped = $false
      } elseif ($char -eq '\') {
        $escaped = $true
      } elseif ($char -eq "'") {
        $inString = $false
      }
      continue
    }
    if ($char -eq "'") {
      $inString = $true
    } elseif ($char -eq '{') {
      $depth++
    } elseif ($char -eq '}') {
      $depth--
      if ($depth -eq 0) {
        $end = $i
        break
      }
    }
  }
  if ($end -lt 0) { throw "Map end not found in $Path" }
  $body = $text.Substring($brace + 1, $end - $brace - 1)
  $map = [ordered]@{}
  $pattern = "(?ms)^\s*'((?:\\'|[^'])+)':\s*((?:'(?:\\'|[^'])*'\s*)+),"
  foreach ($match in [regex]::Matches($body, $pattern)) {
    $key = $match.Groups[1].Value.Replace("\'", "'")
    $parts = [regex]::Matches($match.Groups[2].Value, "'((?:\\'|[^'])*)'")
    $value = ($parts | ForEach-Object {
      $_.Groups[1].Value.Replace("\'", "'").Replace('\n', "`n")
    }) -join ''
    $map[$key] = $value
  }
  return $map
}

$result = Extract-Map $AppLocalizations 'en'
$compact = Extract-Map $CompactTranslations 'en'
foreach ($entry in $compact.GetEnumerator()) {
  $result[$entry.Key] = $entry.Value
}
$result | ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath $OutputJson -Encoding UTF8
Write-Host "Extracted $($result.Count) strings."
