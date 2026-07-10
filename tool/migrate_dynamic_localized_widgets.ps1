param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($file in (Get-ChildItem (Join-Path $Root 'lib') -Recurse -Filter '*.dart')) {
  if ($file.Name -eq 'localized_text.dart') { continue }
  $text = [System.IO.File]::ReadAllText($file.FullName, $utf8)
  $updated = [regex]::Replace(
    $text,
    'LocalizedSelectableText\((?!\s*[''\"]ui\.text\.)',
    'SelectableText(',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  $updated = [regex]::Replace(
    $updated,
    'LocalizedText\((?!\s*[''\"]ui\.text\.)',
    'Text(',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($file.FullName, $updated, $utf8)
    Write-Output "updated $($file.FullName.Substring($Root.Length + 1))"
  }
}
