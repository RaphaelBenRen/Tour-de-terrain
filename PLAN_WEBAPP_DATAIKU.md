# Plan d'implémentation — Webapp Dataiku « Tableau de bord TDT »

> À implémenter dans une webapp Dataiku **standard** (HTML + CSS + JS front + backend Python Flask).
> Objectif : importer les fichiers exportés des tablettes (Tour de Terrain), les cumuler **sans doublons**, et **visualiser** les tentatives (réussies ou non), avec filtres + graphiques, dans le **même style** que la webapp de référence « Commentaires PO Management » (charte Thales).

---

## 0. Prérequis — un ID unique de TDT dans l'export tablette

La déduplication se fait sur un identifiant unique de TDT (**`Tdt_ID`**).
→ L'app tablette doit ajouter une colonne **`Tdt_ID`** en **1ʳᵉ position** de l'export CSV, valeur = identifiant unique généré à la complétion du TDT (ex. `TDT-1737050400000-a3f9`), **stable** (le même à chaque ré-export du TDT).

**Format d'export final (1 ligne par réponse) :**

```
Tdt_ID;Date;Heure;Creneau;Operateur;UAP;Type;Theme;Question;Reponse;Attendu;Resultat;Photos
```

- `Reponse` = `Conforme` | `Non conforme`
- `Attendu` = `Conforme` | `Non conforme`
- `Resultat` = `Juste` | `Faux` (déjà calculé côté tablette)
- Encodage **UTF-8 avec BOM**, séparateur **`;`**.

*(La partie « ajout du `Tdt_ID` » se fait dans le repo tablette, pas dans la webapp Dataiku.)*

---

## 1. Architecture Dataiku

```
[Tablette] --export CSV--> [Import via la webapp]
                                   |
                                   v
                        Backend Python (/import)
                          - parse (pandas)
                          - dédup sur Tdt_ID
                          - append
                                   |
                                   v
                   Dataset managé "TDT_tentatives"  <----- /get_data --->  Front (KPIs + graphes + table)
```

- **Dataset de stockage** : un dataset managé Dataiku **`TDT_tentatives`** (1 ligne par réponse, colonnes ci-dessus). Créé vide au départ avec le bon schéma.
- **Webapp** : type « Standard (HTML/JS) » avec backend Python activé.
- **Read-only** côté données métier : la webapp n'édite pas les réponses ; elle **importe** et **visualise**.

---

## 2. Backend Python (Flask)

```python
import dataiku
import pandas as pd
from flask import request
import io, base64, json

DATASET_NAME = "TDT_tentatives"
ID_COL = "Tdt_ID"

EXPECTED_COLS = ["Tdt_ID","Date","Heure","Creneau","Operateur","UAP","Type",
                 "Theme","Question","Reponse","Attendu","Resultat","Photos"]

def _read_dataset_df():
    ds = dataiku.Dataset(DATASET_NAME)
    try:
        return ds.get_dataframe().fillna("")
    except Exception:
        # dataset vide / pas encore de schéma
        return pd.DataFrame(columns=EXPECTED_COLS)

@app.route('/get_data')
def get_data():
    df = _read_dataset_df()
    return df.to_json(orient='records', force_ascii=False)

@app.route('/import', methods=['POST'])
def import_file():
    """Reçoit { filename, content_base64 }. Parse CSV/xlsx, dédup sur Tdt_ID, append."""
    try:
        payload = json.loads(request.data or "{}")
        name = (payload.get('filename') or '').lower()
        raw = base64.b64decode(payload.get('content_base64', ''))

        # --- Lecture selon le type ---
        if name.endswith('.xlsx') or name.endswith('.xls'):
            new_df = pd.read_excel(io.BytesIO(raw), dtype=str)
        else:
            # CSV tablette : BOM + séparateur ';'
            new_df = pd.read_csv(io.BytesIO(raw), sep=';', dtype=str,
                                 encoding='utf-8-sig', keep_default_na=False)

        new_df = new_df.fillna("")

        # --- Validation des colonnes ---
        missing = [c for c in EXPECTED_COLS if c not in new_df.columns]
        if missing:
            return json.dumps({"status":"error",
                               "message":"Colonnes manquantes : " + ", ".join(missing)}), 400
        new_df = new_df[EXPECTED_COLS]

        # --- Déduplication au niveau TDT (Tdt_ID) ---
        existing = _read_dataset_df()
        existing_ids = set(existing[ID_COL].astype(str)) if len(existing) else set()
        incoming_ids = set(new_df[ID_COL].astype(str))
        new_ids = incoming_ids - existing_ids

        to_add = new_df[new_df[ID_COL].astype(str).isin(new_ids)]

        merged = pd.concat([existing, to_add], ignore_index=True) if len(existing) else to_add
        ds = dataiku.Dataset(DATASET_NAME)
        ds.write_with_schema(merged)

        return json.dumps({
            "status": "success",
            "tdt_ajoutes": len(new_ids),
            "tdt_ignores_doublons": len(incoming_ids) - len(new_ids),
            "lignes_ajoutees": int(len(to_add)),
            "total_lignes": int(len(merged)),
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"status":"error","message":str(e)}), 500
```

**Notes**
- Dédup **au niveau TDT** : si un `Tdt_ID` existe déjà, **tout** le TDT (toutes ses lignes) est ignoré → jamais de doublon partiel.
- `dtype=str` partout pour éviter que pandas altère les valeurs (UAP, dates…).
- `encoding='utf-8-sig'` gère le **BOM** du CSV tablette.
- Support **CSV et .xlsx** (openpyxl requis pour xlsx dans l'env. de code Dataiku).

---

## 3. Frontend — structure HTML (reprise du style de référence)

Réutiliser **tel quel** le squelette/CSS de la webapp de référence (header `#222b75`, `filter-bar`, `table-card`, police Segoe UI, code couleur). Adaptations :

```html
<div class="header-bar">
  <div class="header-left">
    <div class="logo-badge">
      <img src="https://www.thalesaleniaspace.com/assets/img/logoHeader.svg" alt="Thales" class="thales-logo">
    </div>
    <div class="logo-separator"></div>
    <div class="app-title">Tour de Terrain — Tableau de bord</div>
  </div>
  <div style="display:flex; align-items:center;">
    <span id="status-msg" style="margin-right:15px; font-weight:bold;"></span>
    <!-- Remplace "Sauvegarder" par "Importer" -->
    <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none">
    <button id="btn-import" class="main-save-btn">Importer un fichier</button>
  </div>
</div>

<div class="main-container">

  <!-- Barre de filtres (même style que la réf.) -->
  <div class="filter-bar">
    <div class="search-box">
      <input type="text" id="globalSearch" placeholder="Rechercher un opérateur…" />
      <span id="clearSearch" class="clear-icon">&times;</span>
    </div>

    <span class="filter-label">Type :</span>
    <button class="filter-btn type-filter-btn active" data-type="">Tous</button>
    <!-- CALODUCS / COMPOSITE / P10 / TS / USINAGE générés dynamiquement -->

    <span class="filter-label">UAP :</span>
    <button class="filter-btn uap-filter-btn active" data-uap="">Toutes</button>
    <button class="filter-btn uap-filter-btn" data-uap="UAP1">UAP 1</button>
    <button class="filter-btn uap-filter-btn" data-uap="UAP2">UAP 2</button>
    <button class="filter-btn uap-filter-btn" data-uap="UAP3">UAP 3</button>

    <span class="filter-label">Résultat :</span>
    <button class="filter-btn res-filter-btn active" data-res="">Tous</button>
    <button class="filter-btn res-filter-btn" data-res="ok">Réussis</button>
    <button class="filter-btn res-filter-btn" data-res="nok">Avec non-conformité</button>

    <span class="filter-label">Créneau :</span>
    <button class="filter-btn cre-filter-btn active" data-cre="">Tous</button>
    <button class="filter-btn cre-filter-btn" data-cre="Matin">Matin</button>
    <button class="filter-btn cre-filter-btn" data-cre="Apres-midi">Après-midi</button>

    <span class="filter-label">Du :</span> <input type="date" id="dateFrom">
    <span class="filter-label">Au :</span> <input type="date" id="dateTo">

    <button id="btn-reset" class="filter-btn">Réinitialiser</button>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-value" id="kpi-tdt">0</div><div class="kpi-label">TDT</div></div>
    <div class="kpi-card"><div class="kpi-value" id="kpi-ops">0</div><div class="kpi-label">Opérateurs</div></div>
    <div class="kpi-card"><div class="kpi-value" id="kpi-tdt-ok">0%</div><div class="kpi-label">TDT réussis</div></div>
    <div class="kpi-card"><div class="kpi-value" id="kpi-rep-ok">0%</div><div class="kpi-label">Réponses justes</div></div>
  </div>

  <!-- Graphiques -->
  <div class="charts-grid">
    <div class="chart-card"><h3>Taux de réussite — TDT</h3><canvas id="chartTdt"></canvas></div>
    <div class="chart-card"><h3>Taux de réussite — Réponses</h3><canvas id="chartRep"></canvas></div>
    <div class="chart-card"><h3>Par type de production</h3><canvas id="chartType"></canvas></div>
    <div class="chart-card"><h3>Par UAP</h3><canvas id="chartUap"></canvas></div>
    <div class="chart-card wide"><h3>Par opérateur</h3><canvas id="chartOp"></canvas></div>
  </div>

  <!-- Tableau des tentatives (1 ligne par TDT) -->
  <div class="table-card">
    <div class="table-wrapper">
      <table id="tdtTable">
        <thead><tr>
          <th>Date</th><th>Heure</th><th>Créneau</th><th>Opérateur</th>
          <th>UAP</th><th>Type</th><th>Résultat</th><th>Justes/Faux</th>
        </tr></thead>
        <tbody id="tdtBody"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- Panneau détail (drill-down au clic sur une ligne) -->
<div id="detailPanel" class="detail-panel hidden">…</div>
```

**Librairie graphique** : Chart.js via CDN (`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`).
(Si le CDN est bloqué dans l'environnement Dataiku, héberger Chart.js en ressource locale de la webapp.)

---

## 4. Frontend — logique JS

### 4.1 Chargement + agrégation TDT
- `fetch(getWebAppBackendUrl('/get_data'))` → `rows` (1 ligne par réponse).
- Construire un index **par TDT** :

```js
function groupByTdt(rows) {
  const map = new Map();
  rows.forEach(r => {
    const id = r.Tdt_ID;
    if (!map.has(id)) map.set(id, {
      id, date:r.Date, heure:r.Heure, creneau:r.Creneau,
      operateur:r.Operateur, uap:r.UAP, type:r.Type,
      reponses:[], justes:0, faux:0
    });
    const t = map.get(id);
    t.reponses.push(r);
    (r.Resultat === 'Juste') ? t.justes++ : t.faux++;
  });
  // TDT "réussi" = 0 faux
  map.forEach(t => t.reussi = (t.faux === 0));
  return [...map.values()];
}
```

### 4.2 Filtres (même logique que la réf.)
- État : `search, type, uap, res, creneau, dateFrom, dateTo`.
- `getFilteredTdt()` filtre la liste des TDT ; recalcule **KPIs + graphes + table** à chaque changement (comme `refreshTable()` de la réf.).

### 4.3 KPIs
- `nbTDT`, `nbOperateurs` (distinct), `%TDT réussis` = réussis/total, `%réponses justes` = Σjustes / (Σjustes+Σfaux) sur les TDT filtrés.

### 4.4 Graphiques (Chart.js)
- **chartTdt** (donut) : réussis vs avec non-conformité (vert `#28a745` / rouge `#dc3545`).
- **chartRep** (donut) : total réponses justes vs faux.
- **chartType** (barres groupées par Type) : nb TDT + % réussite (2 datasets ou barre + ligne).
- **chartUap** (barres) : nb TDT par UAP (+ % réussite en couleur/étiquette).
- **chartOp** (barres horizontales, top N) : par opérateur, nb TDT + % réussite.
- Détruire/recréer les charts à chaque refresh (`chart.destroy()` avant re-render).

### 4.5 Tableau + détail au clic
- 1 ligne par TDT ; pastille **verte** (réussi) / **rouge** (non-conformité) — réutiliser les variables `--status-green/red` de la réf.
- Clic sur une ligne → ouvre le **panneau détail** : liste des réponses du TDT regroupées par `Theme`, chaque question avec `Reponse` / `Attendu` et une couleur verte (Juste) / rouge (Faux) — reproduit la « fiche » de l'app tablette.

### 4.6 Import
```js
document.getElementById('btn-import').onclick = () => fileInput.click();
fileInput.onchange = () => {
  const f = fileInput.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const b64 = reader.result.split(',')[1]; // base64
    setStatus("Import en cours…");
    fetch(getWebAppBackendUrl('/import'), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ filename:f.name, content_base64:b64 })
    }).then(r=>r.json()).then(res=>{
      if (res.status==='success') {
        setStatus(`✓ ${res.tdt_ajoutes} TDT ajoutés, ${res.tdt_ignores_doublons} doublons ignorés`);
        reloadData(); // re-fetch /get_data + refresh
      } else setStatus("Erreur : "+res.message);
    });
    fileInput.value = "";
  };
  reader.readAsDataURL(f);
};
```

---

## 5. Style (repris de la webapp de référence)

- **Réutiliser** le CSS fourni : `.header-bar` (#222b75), `.thales-logo`, `.filter-bar`, `.filter-btn`/`.active`, `.table-card`, `.table-wrapper`, `th` sticky, code couleur `--status-green/red/yellow`, police `Segoe UI`.
- **Ajouter** :
  - `.kpi-row` (flex) + `.kpi-card` (carte blanche, ombre légère, `.kpi-value` gros chiffre bleu `#222b75`, `.kpi-label` gris).
  - `.charts-grid` (grid responsive, 2 colonnes → 1 sur petit écran) + `.chart-card` (carte blanche, titre, `canvas`).
  - `.detail-panel` (panneau latéral ou modal, fond blanc, ombre), réutilisant les couleurs vert/rouge pour Juste/Faux.
- **Réussi = vert**, **Non-conformité = rouge** (cohérent avec la tablette et la réf.).

---

## 6. Ordre de construction conseillé

1. Créer le dataset managé **`TDT_tentatives`** (vide, schéma = 13 colonnes).
2. Backend : `/get_data` + `/import` (avec dédup) — tester l'import d'un CSV tablette.
3. Front : header + bouton Importer + message de statut.
4. Front : `groupByTdt` + tableau des TDT (sans filtres).
5. Front : barre de filtres + `getFilteredTdt()` + refresh.
6. Front : KPIs.
7. Front : graphiques Chart.js.
8. Front : panneau détail au clic.
9. Polish visuel (charte, responsive) + messages d'erreur.

---

## 7. Points d'attention / cas limites

- **BOM + `;`** : `pd.read_csv(..., sep=';', encoding='utf-8-sig')`.
- **xlsx** : `pd.read_excel(..., dtype=str)` (openpyxl dans l'env. de code).
- **Colonnes manquantes / mauvais fichier** → message d'erreur clair, ne rien écrire.
- **Dataset vide au départ** → gérer le cas (DataFrame vide avec schéma).
- **Dédup au niveau TDT** (pas ligne par ligne) sur `Tdt_ID`.
- **Photos** : colonne = noms de fichiers uniquement (les images ne sont pas dans Dataiku) → afficher les noms, ou masquer la colonne.
- **Perf** : quelques milliers de lignes OK côté JS ; si gros volume, faire les agrégations dans un `/stats` backend.
- **Logo Thales** : si l'URL externe est bloquée par la CSP Dataiku, héberger le SVG en ressource locale de la webapp.

---

## 8. Extensions possibles (non prioritaires)

- Graphique **tentatives dans le temps** (par jour/semaine).
- **Top non-conformités** (questions les plus souvent fausses).
- Export du sous-ensemble filtré (CSV).
- Filtre par **Thème**.
