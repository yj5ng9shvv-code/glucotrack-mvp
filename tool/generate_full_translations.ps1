param(
  [Parameter(Mandatory = $true)]
  [string]$SourceJson,
  [Parameter(Mandatory = $true)]
  [string]$OutputJson
  ,
  [string]$SourceLanguage = 'en'
)

$ErrorActionPreference = 'Stop'
$sourceObject = Get-Content -LiteralPath $SourceJson -Raw -Encoding UTF8 |
  ConvertFrom-Json
$source = [ordered]@{}
foreach ($property in $sourceObject.PSObject.Properties) {
  $source[$property.Name] = [string]$property.Value
}
$languages = @(
  'en','de','fr','es','it','pl','uk','ru','pt','nl','ro','cs','sk','hu',
  'sv','da','fi','no','el','tr','bg','hr','sl','lt','lv','et','sr','sq',
  'mk','is'
)

$result = [ordered]@{}
if ($SourceLanguage -ne 'auto') {
  $result.en = $source
}

function Protect-Placeholders([string]$Text) {
  $script:placeholderIndex = 0
  $items = [ordered]@{}
  $protected = [regex]::Replace(
    $Text,
    '\{[^}]+\}|https?://\S+|[A-Z][A-Z0-9_]{2,}|mmol/L|mg/dL|GlucoTrack|OpenAI|Stripe|Premium|SOS|AI|PDF|CSV|HTML|Email',
    {
      param($match)
      $token = "ZXQPH$($script:placeholderIndex)QXZ"
      $items[$token] = $match.Value
      $script:placeholderIndex++
      return $token
    }
  )
  return @{ Text = $protected; Items = $items }
}

function Restore-Placeholders([string]$Text, $Items) {
  $restored = $Text
  foreach ($entry in $Items.GetEnumerator()) {
    $restored = $restored.Replace($entry.Key, $entry.Value)
  }
  return $restored
}

function Translate-Text([string]$Text, [string]$Language) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
  $protected = Protect-Placeholders $Text
  $query = [uri]::EscapeDataString($protected.Text)
  $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=$SourceLanguage&tl=$Language&dt=t&q=$query"
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 45
      $translated = ($response[0] | ForEach-Object { $_[0] }) -join ''
      return Restore-Placeholders $translated $protected.Items
    } catch {
      if ($attempt -eq 5) { throw }
      Start-Sleep -Seconds ([Math]::Min(10, $attempt * 2))
    }
  }
}

foreach ($language in $languages | Where-Object { $SourceLanguage -eq 'auto' -or $_ -ne 'en' }) {
  Write-Host "Translating $language..."
  $map = [ordered]@{}
  $position = 0
  foreach ($entry in $source.GetEnumerator()) {
    $map[$entry.Key] = Translate-Text ([string]$entry.Value) $language
    $position++
    if (($position % 25) -eq 0) {
      Write-Host "  $position / $($source.Count)"
    }
    Start-Sleep -Milliseconds 60
  }
  $result[$language] = $map
  $result | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $OutputJson -Encoding UTF8
}

$result | ConvertTo-Json -Depth 6 |
  Set-Content -LiteralPath $OutputJson -Encoding UTF8
