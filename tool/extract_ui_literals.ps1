param(
  [Parameter(Mandatory = $true)]
  [string]$OutputJson
)

$ErrorActionPreference = 'Stop'
$files = Get-ChildItem lib -Recurse -Include *.dart |
  Where-Object { $_.FullName -notmatch 'full_translations\.dart$' }
$literals = [ordered]@{}
$patterns = @(
  "Text\(\s*'((?:\\'|[^']){2,})'",
  "const Text\(\s*'((?:\\'|[^']){2,})'",
  "SelectableText\(\s*'((?:\\'|[^']){2,})'",
  "labelText:\s*'((?:\\'|[^']){2,})'",
  "hintText:\s*'((?:\\'|[^']){2,})'",
  "helperText:\s*'((?:\\'|[^']){2,})'",
  "tooltip:\s*'((?:\\'|[^']){2,})'",
  "title:\s*'((?:\\'|[^']){2,})'",
  "subtitle:\s*'((?:\\'|[^']){2,})'",
  "\.literal\(\s*'((?:\\'|[^']){2,})'",
  "\btr\(\s*'((?:\\'|[^']){2,})'"
)
foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  foreach ($pattern in $patterns) {
    foreach ($match in [regex]::Matches($text, $pattern)) {
      $value = $match.Groups[1].Value
      if ($value -match '^[/#][A-Za-z0-9_/-]+$') { continue }
      if ($value -match '^[A-Za-z0-9_.-]+\.(dart|js|json)$') { continue }
      if ($value.Trim().Length -lt 2) { continue }
      $literals[$value] = $value
    }
  }
}
$literals | ConvertTo-Json -Depth 4 |
  Set-Content -LiteralPath $OutputJson -Encoding UTF8
Write-Host "Extracted $($literals.Count) UI literals."
