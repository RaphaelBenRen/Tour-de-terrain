# Bibliotheque : lecture d'un classeur Excel Tour de Terrain en PowerShell pur.
# Un .xlsx est un ZIP de fichiers XML -> aucune dependance (ni Python, ni Excel).
# Fonction principale : ConvertFrom-TdtWorkbook <chemin.xlsx>
#   -> renvoie une structure  { TYPE = { theme = @(questions...) } }

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Convert-ColRef([string]$ref) {
  $m = [regex]::Match($ref, '^([A-Z]+)(\d+)$')
  $letters = $m.Groups[1].Value; $row = [int]$m.Groups[2].Value
  $col = 0
  foreach ($ch in $letters.ToCharArray()) { $col = $col * 26 + ([int][char]$ch - 64) }
  return @{ Col = $col; Row = $row }
}

function Normalize-Text($s) {
  if ($null -eq $s) { return "" }
  $s = [string]$s
  $s = $s -replace "[\r\n]+", " "
  $s = $s -replace "\s+", " "
  $s = $s.Trim()
  # Retire une puce en debut de ligne : tiret, tiret demi-cadratin/cadratin, puce, asterisque.
  $s = $s -replace "^[\-–—•\*]+\s*", ""
  return $s.Trim()
}

# Minuscule sans accents (pour reconnaitre les mots-cles "Theme", "Evaluation"...).
function To-Key($s) {
  if (-not $s) { return "" }
  $n = ([string]$s).Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($c)
    }
  }
  return $sb.ToString().ToLower().Trim()
}

function Read-SharedStrings($dir) {
  $p = Join-Path $dir "xl\sharedStrings.xml"
  $arr = New-Object Collections.ArrayList
  if (Test-Path $p) {
    [xml]$x = Get-Content $p -Raw -Encoding UTF8
    $ns = New-Object Xml.XmlNamespaceManager($x.NameTable)
    $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    foreach ($si in $x.SelectNodes("//d:si", $ns)) {
      $s = ""
      foreach ($t in $si.SelectNodes(".//d:t", $ns)) { $s += $t.InnerText }
      [void]$arr.Add($s)
    }
  }
  return $arr
}

function Get-SheetMap($dir) {
  [xml]$wb = Get-Content (Join-Path $dir "xl\workbook.xml") -Raw -Encoding UTF8
  $ns = New-Object Xml.XmlNamespaceManager($wb.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  [xml]$rels = Get-Content (Join-Path $dir "xl\_rels\workbook.xml.rels") -Raw -Encoding UTF8
  $nsr = New-Object Xml.XmlNamespaceManager($rels.NameTable)
  $nsr.AddNamespace("p", "http://schemas.openxmlformats.org/package/2006/relationships")
  $relMap = @{}
  foreach ($rel in $rels.SelectNodes("//p:Relationship", $nsr)) { $relMap[$rel.Id] = $rel.Target }
  $map = [ordered]@{}
  foreach ($sh in $wb.SelectNodes("//d:sheet", $ns)) {
    $name = $sh.name
    $rid = $sh.GetAttribute("r:id")
    if (-not $rid) {
      $a = $sh.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -First 1
      if ($a) { $rid = $a.Value }
    }
    $target = $relMap[$rid]
    if ($target -notmatch "^xl/") { $target = "xl/$target" }
    $map[$name] = (Join-Path $dir ($target -replace "/", "\"))
  }
  return $map
}

function Read-Sheet($path, $shared) {
  [xml]$x = Get-Content $path -Raw -Encoding UTF8
  $ns = New-Object Xml.XmlNamespaceManager($x.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $cells = @{}; $maxRow = 0
  foreach ($c in $x.SelectNodes("//d:c", $ns)) {
    $ref = $c.GetAttribute("r"); if (-not $ref) { continue }
    $rc = Convert-ColRef $ref
    $t = $c.GetAttribute("t"); $val = ""
    if ($t -eq "s") {
      $v = $c.SelectSingleNode("d:v", $ns)
      if ($v) { $idx = [int]$v.InnerText; if ($idx -lt $shared.Count) { $val = $shared[$idx] } }
    }
    elseif ($t -eq "inlineStr") {
      $isn = $c.SelectSingleNode("d:is", $ns)
      if ($isn) { foreach ($t2 in $isn.SelectNodes(".//d:t", $ns)) { $val += $t2.InnerText } }
    }
    else {
      $v = $c.SelectSingleNode("d:v", $ns); if ($v) { $val = $v.InnerText }
    }
    $cells["$($rc.Row),$($rc.Col)"] = $val
    if ($rc.Row -gt $maxRow) { $maxRow = $rc.Row }
  }
  return @{ Cells = $cells; MaxRow = $maxRow }
}

# Extrait { theme = @(questions) } d'une feuille type :
# colonne B = theme (rempli au debut de chaque groupe), colonne C = la question.
function ConvertTo-Questionnaire($sheet) {
  $cells = $sheet.Cells; $maxRow = $sheet.MaxRow
  $result = [ordered]@{}; $current = $null; $started = $false
  for ($r = 1; $r -le $maxRow; $r++) {
    $b = Normalize-Text $cells["$r,2"]
    $c = Normalize-Text $cells["$r,3"]
    if (-not $started) { if ((To-Key $b) -eq "theme") { $started = $true }; continue }
    if ((To-Key $b).StartsWith("evaluation") -or (To-Key $c).StartsWith("evaluation")) { break }
    if ($b) { $current = $b; if (-not $result.Contains($current)) { $result[$current] = New-Object Collections.ArrayList } }
    if ($c -and $current) {
      $ck = To-Key $c
      if ($ck -ne "heure" -and $ck -ne "debut" -and $ck -ne "fin" -and $ck -ne "elements observes") {
        [void]$result[$current].Add($c)
      }
    }
  }
  $out = [ordered]@{}
  foreach ($k in $result.Keys) { if ($result[$k].Count -gt 0) { $out[$k] = @($result[$k]) } }
  return $out
}

function ConvertFrom-TdtWorkbook($xlsxPath) {
  $tmp = Join-Path $env:TEMP ("tdt_xlsx_" + [IO.Path]::GetFileNameWithoutExtension($xlsxPath))
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $xlsxPath).Path, $tmp)

  $shared = Read-SharedStrings $tmp
  $sheetMap = Get-SheetMap $tmp
  $data = [ordered]@{}
  $prefix = "Check-List du TdT "
  foreach ($name in $sheetMap.Keys) {
    if ($name.StartsWith($prefix)) {
      $type = $name.Substring($prefix.Length).Trim()
      $sheet = Read-Sheet $sheetMap[$name] $shared
      $q = ConvertTo-Questionnaire $sheet
      if ($q.Count -gt 0) { $data[$type] = $q }
    }
  }
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  return $data
}
