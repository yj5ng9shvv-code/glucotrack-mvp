param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$utf8 = [System.Text.UTF8Encoding]::new($false)
$sha = [System.Security.Cryptography.SHA256]::Create()
$patternText = @'
\.literal\(\s*(?<literal>'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*\)
'@
$pattern = [regex]::new($patternText.Trim())
$entries = @{}
foreach ($file in (Get-ChildItem (Join-Path $Root 'lib') -Recurse -Filter '*.dart')) {
  if ($file.Name -in @('app_localizations.dart', 'ui_key_sources.dart')) { continue }
  $text = [System.IO.File]::ReadAllText($file.FullName, $utf8)
  $updated = $pattern.Replace($text, {
    param($match)
    $literal = $match.Groups['literal'].Value
    if ($literal.Contains('$')) { return $match.Value }
    $hash = [System.BitConverter]::ToString(
      $sha.ComputeHash($utf8.GetBytes($literal))
    ).Replace('-', '').Substring(0, 12).ToLowerInvariant()
    $key = "ui.text.$hash"
    $entries[$key] = $literal
    return ".t('$key')"
  })
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($file.FullName, $updated, $utf8)
    Write-Output "updated $($file.FullName.Substring($Root.Length + 1))"
  }
}

$mapPath = Join-Path $Root 'lib\l10n\ui_key_sources.dart'
$map = [System.IO.File]::ReadAllText($mapPath, $utf8)
$newLines = @()
foreach ($key in ($entries.Keys | Sort-Object)) {
  if ($map -notmatch [regex]::Escape("'$key':")) {
    $newLines += "  '$key': $($entries[$key]),"
  }
}
if ($newLines.Count -gt 0) {
  $map = $map -replace "\r?\n};\s*$", "`r`n$($newLines -join "`r`n")`r`n};`r`n"
  [System.IO.File]::WriteAllText($mapPath, $map, $utf8)
}
Write-Output "new keys $($newLines.Count)"
