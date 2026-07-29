# Import d'un questionnaire Tour de Terrain pour UN UAP (100% PowerShell, sans Python).
#
# Lance par les .bat :  powershell -File import_questionnaire.ps1 -Uap 1
# Lit  UAP<n>.xlsx  (a deposer dans ce dossier), met a jour le slot de cet UAP
# dans le fichier maitre checklist.json (les autres UAP restent intacts),
# puis l'envoie sur la tablette via USB/MTP.

param([Parameter(Mandatory = $true)][ValidateSet("1", "2", "3")][string]$Uap)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here "tdt_excel.ps1")
. (Join-Path $here "tdt_push.ps1")

$excel = Join-Path $here "UAP$Uap.xlsx"
$masterPath = Join-Path $here "checklist.json"

Write-Host "======================================================================"
Write-Host "   IMPORT QUESTIONNAIRES  ->  UAP $Uap"
Write-Host "======================================================================"

if (-not (Test-Path $excel)) {
  Write-Host "`n[ERREUR] Fichier introuvable : UAP$Uap.xlsx" -ForegroundColor Red
  Write-Host "         Depose ton Excel dans ce dossier et renomme-le  UAP$Uap.xlsx"
  Write-Host "         Dossier : $here"
  exit 1
}

# 1) Lecture / conversion de l'Excel
try {
  $data = ConvertFrom-TdtWorkbook $excel
}
catch {
  Write-Host "`n[ERREUR] Lecture de l'Excel impossible : $_" -ForegroundColor Red
  exit 1
}
if ($data.Count -eq 0) {
  Write-Host "`n[ERREUR] Aucune feuille 'Check-List du TdT <TYPE>' trouvee dans l'Excel." -ForegroundColor Red
  exit 1
}

Write-Host "`nTypes lus dans UAP$Uap.xlsx :"
foreach ($type in $data.Keys) {
  $tot = 0; foreach ($th in $data[$type].Keys) { $tot += $data[$type][$th].Count }
  Write-Host ("   - {0,-10} : {1} questions" -f $type, $tot)
}

# 2) Mise a jour du fichier maitre (par UAP) sans toucher aux autres UAP
$master = [ordered]@{}
if (Test-Path $masterPath) {
  try {
    $existing = Get-Content $masterPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $existing.PSObject.Properties) { $master[$p.Name] = $p.Value }
  }
  catch { $master = [ordered]@{} }
}
$master["$Uap"] = $data

$json = $master | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($masterPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`nFichier maitre mis a jour : $masterPath"
$present = @("1", "2", "3") | Where-Object { $master.Contains($_) }
Write-Host ("UAP presents dans le maitre : " + ($present -join ", "))
$absents = @("1", "2", "3") | Where-Object { -not $master.Contains($_) }
if ($absents.Count -gt 0) {
  Write-Host ("[INFO] UAP pas encore importes : " + ($absents -join ", ") +
    " (la tablette n'aura pas leurs questionnaires)") -ForegroundColor Yellow
}

# 3) Envoi sur la tablette (USB / MTP)
Write-Host "`nEnvoi vers la tablette (USB / mode 'Transfert de fichiers')..."
$ok = Push-ChecklistToTablet -ChecklistPath $masterPath

if ($ok) {
  Write-Host "`n----------------------------------------------------------------------"
  Write-Host "[OK] Questionnaires envoyes sur la tablette." -ForegroundColor Green
  Write-Host "     -> Relance l'application pour charger les nouveaux questionnaires."
  Write-Host "----------------------------------------------------------------------"
  exit 0
}
else {
  Write-Host "`n[ERREUR] L'envoi vers la tablette a echoue." -ForegroundColor Red
  Write-Host "         Verifie que la tablette est branchee en mode 'Transfert de fichiers' (MTP),"
  Write-Host "         et que l'application a bien ete lancee au moins une fois."
  exit 1
}
