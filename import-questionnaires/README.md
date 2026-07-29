# Import des questionnaires Tour de Terrain (par UAP)

Permet de **changer les questionnaires** de la tablette depuis un PC, à partir
des fichiers Excel. Chaque UAP a son propre questionnaire (par type de production).

> **100 % PowerShell** — comme les scripts de collecte. **Rien à installer**
> (ni Python, ni Excel) : ça utilise le PowerShell déjà présent dans Windows.

## Prérequis

1. L'application **« Tour de Terrain v2 »** installée sur la tablette et **lancée
   au moins une fois** (cela crée le dossier de l'app).
2. Tablette branchée en USB, notification → **« Transfert de fichiers » (MTP)**.

## Utilisation

1. Prends l'Excel du questionnaire à mettre à jour et **dépose-le dans CE dossier**
   en le renommant selon l'UAP :
   - `UAP1.xlsx` pour l'UAP 1
   - `UAP2.xlsx` pour l'UAP 2
   - `UAP3.xlsx` pour l'UAP 3
2. **Double-clique** sur le `.bat` correspondant :
   - `importQuestionnaireUAP1.bat`
   - `importQuestionnaireUAP2.bat`
   - `importQuestionnaireUAP3.bat`
3. Le script lit l'Excel, met à jour le questionnaire de **cet UAP uniquement**,
   puis l'envoie sur la tablette.
4. **Relance l'application** sur la tablette → les nouveaux questionnaires sont chargés.

> Tu peux mettre à jour un seul UAP à la fois : les 2 autres ne sont pas touchés.

## Ce qui est attendu dans l'Excel

- Une feuille par type de production, nommée **`Check-List du TdT <TYPE>`**
  (CALODUCS, COMPOSITE, P10, TS, USINAGE).
- Dans chaque feuille : **colonne B = Thème**, **colonne C = la question**.
- La grille Conforme/Non conforme (J/L) n'est pas lue : par principe, toutes les
  questions sont « attendues Conforme ». Une non-conformité cochée → photo +
  pastille rouge dans l'app.
- Le texte est importé **fidèlement** (si une faute est dans l'Excel, corrige-la
  dans l'Excel puis ré-importe).

## Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `importQuestionnaireUAP1/2/3.bat` | À double-cliquer (un par UAP) |
| `import_questionnaire.ps1` | Lit l'Excel, met à jour `checklist.json`, lance l'envoi |
| `tdt_excel.ps1` | Lecture du fichier Excel (PowerShell pur) |
| `tdt_push.ps1` | Envoi du `checklist.json` sur la tablette (USB/MTP) |
| `checklist.json` | **Fichier maître** : contient les questionnaires des 3 UAP |

⚠️ Ne supprime pas `checklist.json` : c'est lui qui garde les 3 UAP ensemble
(chaque import ne met à jour que son UAP).

## En cas de souci

- **« Fichier introuvable : UAP1.xlsx »** → l'Excel n'est pas dans ce dossier ou
  mal renommé.
- **« Aucune tablette Galaxy connectée »** → vérifie le câble et le mode
  « Transfert de fichiers » (MTP) sur la tablette.
- **« Dossier de l'app introuvable »** → installe l'app et lance-la une fois
  (fais un TDT) pour créer le dossier.
