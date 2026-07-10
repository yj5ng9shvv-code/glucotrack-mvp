param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$utf8 = [System.Text.UTF8Encoding]::new($false)
$patternText = @'
Localized(?<kind>Selectable)?Text\(\s*(?<literal>'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")
'@
$pattern = [regex]::new($patternText.Trim())
foreach ($file in (Get-ChildItem (Join-Path $Root 'lib') -Recurse -Filter '*.dart')) {
  if ($file.Name -eq 'localized_text.dart') { continue }
  $text = [System.IO.File]::ReadAllText($file.FullName, $utf8)
  $updated = $pattern.Replace($text, {
    param($match)
    if (-not $match.Groups['literal'].Value.Contains('$')) { return $match.Value }
    $replacement = if ($match.Groups['kind'].Success) { 'SelectableText(' } else { 'Text(' }
    return $replacement + $match.Value.Substring($match.Value.IndexOf('(') + 1)
  })
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($file.FullName, $updated, $utf8)
    Write-Output "updated $($file.FullName.Substring($Root.Length + 1))"
  }
}
