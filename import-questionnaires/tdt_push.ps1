# Bibliotheque : envoi du fichier checklist.json sur la tablette via USB/MTP.
# Meme mecanisme (Shell.Application) que les scripts de collecte.
# Fonction : Push-ChecklistToTablet <chemin checklist.json>  -> $true / $false

function Get-ConnectedGalaxyTab {
  $computer = New-Object -com Shell.Application
  $root = $computer.NameSpace(0x11)
  $dev = $root.Items() | Where-Object { $_.Name -like "*Galaxy*" } | Select-Object -First 1
  if ($dev) { return $dev.Name } else { return $null }
}

function Get-SubFolder($parentDir, $subPath) {
  $result = $parentDir
  foreach ($seg in ($subPath -split "\\")) {
    $result = $result.GetFolder.Items() | Where-Object { $_.Name -eq $seg } | Select-Object -First 1
    if ($null -eq $result) { return $null }
  }
  return $result
}

function Get-PhoneMainDir($phoneName) {
  $o = New-Object -com Shell.Application
  $root = $o.NameSpace(0x11)
  $dir = $root.Items() | Where-Object { $_.Name -eq $phoneName } | Select-Object -First 1
  if ($null -eq $dir) { throw "Tablette '$phoneName' introuvable dans 'Ce PC'." }
  return $dir
}

function Push-ChecklistToTablet([string]$ChecklistPath) {
  $PKG = "tas.checklist.tdtv2"

  if (-not (Test-Path $ChecklistPath)) {
    Write-Host "[ERREUR] Fichier introuvable : $ChecklistPath" -ForegroundColor Red
    return $false
  }

  $tablet = Get-ConnectedGalaxyTab
  if (-not $tablet) {
    Write-Host "[ERREUR] Aucune tablette Galaxy connectee (branche-la en mode 'Transfert de fichiers')." -ForegroundColor Red
    return $false
  }
  Write-Host "Tablette : $tablet"

  $main = Get-PhoneMainDir $tablet
  $tabletPath = Get-SubFolder $main "Tablet\Android\data\$PKG\files"
  if ($null -eq $tabletPath) {
    $tabletPath = Get-SubFolder $main "Stockage interne\Android\data\$PKG\files"
  }
  if ($null -eq $tabletPath) {
    Write-Host "[ERREUR] Dossier de l'app introuvable ($PKG). L'app est-elle installee et lancee au moins une fois ?" -ForegroundColor Red
    return $false
  }
  $folder = $tabletPath.GetFolder

  # 1) Supprime l'ancien checklist.json (MoveHere vers un dossier temporaire :
  #    methode fiable, identique a ce que font les scripts de collecte).
  $temp = Join-Path $env:TEMP "tdt_old_checklist"
  if (-not (Test-Path $temp)) { New-Item -ItemType Directory -Path $temp | Out-Null }
  $tempShell = (New-Object -com Shell.Application).NameSpace($temp)
  foreach ($it in @($folder.Items())) {
    $n = $it.Name.ToLower()
    if ($n -eq "checklist.json" -or $n -eq "checklist") {
      Write-Host "Suppression de l'ancien checklist.json..."
      $tempShell.MoveHere($it)
      Start-Sleep -Seconds 1
    }
  }

  # 2) Copie du nouveau checklist.json sur la tablette.
  $srcDir = Split-Path $ChecklistPath -Parent
  $srcName = Split-Path $ChecklistPath -Leaf
  $srcShell = (New-Object -com Shell.Application).NameSpace($srcDir)
  $srcItem = $srcShell.ParseName($srcName)
  if ($null -eq $srcItem) { Write-Host "[ERREUR] Impossible de lire $ChecklistPath" -ForegroundColor Red; return $false }

  Write-Host "Copie de checklist.json vers la tablette..."
  $folder.CopyHere($srcItem, 16)

  # 3) Attente que le fichier apparaisse cote tablette (copie MTP asynchrone).
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $found = @($folder.Items() | Where-Object {
        $_.Name.ToLower() -eq "checklist.json" -or $_.Name.ToLower() -eq "checklist" })
    if ($found.Count -gt 0) {
      Write-Host "checklist.json present sur la tablette." -ForegroundColor Green
      return $true
    }
  }
  Write-Host "[ERREUR] Le fichier n'est pas apparu sur la tablette (delai depasse)." -ForegroundColor Red
  return $false
}
