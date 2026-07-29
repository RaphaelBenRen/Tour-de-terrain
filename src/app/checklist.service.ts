import { Injectable } from '@angular/core';
// Checklist embarquée dans l'app : sert de contenu par défaut à l'installation,
// pour que le TDT fonctionne même sans fichier importé sur la tablette.
import bundledChecklist from '../assets/file.json';
import { Checklist } from './checklist';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { PlatformService } from './services/platform.service';
@Injectable({
  providedIn: 'root',
})
export class ChecklistService {
  listCheckList: Checklist[] = [];
  username: string = '';
  uap: number = 1;
  typeForUap: string = '';
  errorParsingFile: boolean = false;

  /**
   * Ensemble des checklists PAR UAP :
   * { "1": { TYPE: { thème: [questions] } }, "2": {...}, "3": {...} }
   * Les questionnaires peuvent donc différer d'un UAP à l'autre.
   */
  allByUap: { [uap: string]: any } = {};
  /** Type de production actuellement sélectionné. */
  selectedType: string = '';
  /** Contenu (thème -> questions) du type + UAP sélectionnés (sert à `restartService`). */
  checklistData: any = {};

  constructor(private file: File, private platform: PlatformService) {
    // IMPORTANT : chargement SYNCHRONE de la checklist embarquée dès la création
    // du service -> la liste des questions n'est jamais vide et « Démarrer le
    // TDT » ouvre toujours les questions (correction définitive du bug).
    this.setAllData(bundledChecklist);

    // Ensuite seulement, après `deviceready`, on tente de charger un éventuel
    // `checklist.json` importé sur la tablette (qui remplacera l'embarqué).
    this.platform.ready().then(() => this.loadChecklistFile());
  }

  /**
   * Tente de charger un fichier `checklist.json` importé sur la tablette et,
   * s'il est valide, remplace les checklists embarquées par son contenu.
   * En cas d'absence ou d'erreur, on garde simplement l'embarqué déjà chargé.
   */
  private loadChecklistFile() {
    return this.file
      .readAsText(this.file.externalDataDirectory, 'checklist.json')
      .then((fichier) => {
        let data: any = null;
        try {
          data = JSON.parse(fichier);
        } catch {
          data = null;
        }
        if (!this.setAllData(data)) {
          // Fichier importé invalide : on conserve l'embarqué sans erreur.
          this.errorParsingFile = false;
        }
      })
      .catch(() => {
        // Pas de fichier importé : on garde l'embarqué déjà chargé.
      });
  }

  /**
   * Charge l'ensemble des checklists et les normalise au format PAR UAP.
   * Accepte 3 formats (pour rétro-compatibilité) :
   *   - par UAP  : { "1": { TYPE: { thème:[q] } }, ... }
   *   - par type : { TYPE: { thème:[q] } }         -> appliqué aux 3 UAP
   *   - plat     : { thème:[q] }                   -> un seul type « Checklist »
   */
  private setAllData(data: any): boolean {
    const byUap = this.normalizeToByUap(data);
    if (!byUap) {
      this.errorParsingFile = true;
      return false;
    }
    this.allByUap = byUap;
    // Cale l'UAP courant sur une valeur existante.
    const types = this.getTypes(this.uap);
    if (!types.includes(this.selectedType)) {
      this.selectedType = types[0] || '';
    }
    this.setType(this.selectedType);
    this.errorParsingFile = false;
    return true;
  }

  /** Détecte le format des données et renvoie toujours { uap: { type: {thème:[q]} } }. */
  private normalizeToByUap(data: any): { [uap: string]: any } | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const keys = Object.keys(data);
    if (!keys.length) return null;

    const first = data[keys[0]];
    // Format plat { thème: [q] } -> un seul type « Checklist », pour les 3 UAP.
    if (Array.isArray(first)) {
      const wrapped = { Checklist: data };
      return { '1': wrapped, '2': wrapped, '3': wrapped };
    }
    if (!first || typeof first !== 'object') return null;

    const subKeys = Object.keys(first);
    const firstSub = subKeys.length ? first[subKeys[0]] : null;
    // Format par type { TYPE: { thème:[q] } } -> même jeu pour les 3 UAP.
    if (Array.isArray(firstSub)) {
      return { '1': data, '2': data, '3': data };
    }
    // Format par UAP { UAP: { TYPE: { thème:[q] } } }.
    return data;
  }

  /** Clé UAP existante la plus proche (repli sur la première disponible). */
  private resolveUapKey(uap: number | string): string {
    const k = String(uap);
    if (this.allByUap[k]) return k;
    return Object.keys(this.allByUap)[0] || '';
  }

  /** Types de production disponibles pour un UAP donné. */
  getTypes(uap: number | string): string[] {
    const d = this.allByUap[this.resolveUapKey(uap)];
    return d ? Object.keys(d) : [];
  }

  /** Union de tous les types, tous UAP confondus (pour les filtres). */
  get allTypes(): string[] {
    const set = new Set<string>();
    for (const uap of Object.keys(this.allByUap)) {
      for (const t of Object.keys(this.allByUap[uap] || {})) set.add(t);
    }
    return Array.from(set);
  }

  /** Types disponibles pour l'UAP actuellement sélectionné. */
  get availableTypes(): string[] {
    return this.getTypes(this.uap);
  }

  /** Sélectionne un type de production (pour l'UAP courant) et (re)construit sa checklist. */
  setType(type: string) {
    const typesData = this.allByUap[this.resolveUapKey(this.uap)] || {};
    if (!typesData[type]) {
      type = Object.keys(typesData)[0] || '';
    }
    this.selectedType = type;
    this.buildFromData(typesData[type] || {});
  }

  /** Construit `listCheckList` à partir d'un objet { thème -> questions }. */
  private buildFromData(data: any): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.errorParsingFile = true;
      return false;
    }
    this.checklistData = data;
    this.listCheckList = [];
    for (const [title, items] of Object.entries(data)) {
      if (!Array.isArray(items)) continue;
      this.listCheckList.push({
        title,
        listCheck: items.map((item: any) => {
          // Une question peut être une simple chaîne (réponse attendue = Conforme)
          // ou un objet { q|question|description, expected } pour un autre corrigé.
          if (typeof item === 'string') {
            return { title: '', description: item, checked: null, expected: true };
          }
          return {
            title: '',
            description: item.q ?? item.question ?? item.description ?? '',
            checked: null,
            expected: item.expected !== false,
          };
        }),
      });
    }
    this.errorParsingFile = false;
    return true;
  }

  restartService() {
    this.username = '';
    this.uap = 1;
    this.setType(this.selectedType);
  }
  exportToCSV(fileName: string) {
    // Convert the JSON data to CSV format
    let jsonData = this.listCheckList;
    const csvData = this.convertToCSV(jsonData);
    var window: any;

    // Create a blob object from the CSV data
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const externalDataDirectory = this.file.externalDataDirectory;
    // Create a download link element
    return this.file.writeFile(externalDataDirectory, fileName + ".csv", blob, { replace: true });



  }

  // Convert JSON data to CSV format
  convertToCSV(jsonData: any): string {
    const csvData = [];

    // Get the headers from the first object in the array
    const headers: string[] = [];
    headers.push('Thème');
    headers.push('Question');
    headers.push('Réponse');
    // Add the headers to the CSV data
    csvData.push(headers.join(';'));
    console.log(jsonData);

    // Loop through the data and add each row to the CSV data
    jsonData.forEach((obj: Checklist) => {
      const row: any[] = [];
      obj.listCheck.forEach((value) => {
        const line: any[] = [];
        line.push(obj.title);
        line.push(value.description?.replaceAll(',', '').replaceAll('\n', ' '));

        line.push(value.checked == null ? 'null' : value.checked);
        row.push(line.join(';') + '\n');
      });
      console.log(row);

      csvData.push(row.join(''));
    });

    // Join the CSV data into a string
    return csvData.join('\n');
  }
}
