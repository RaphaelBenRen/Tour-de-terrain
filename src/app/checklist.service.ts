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
  uap: number = 0;
  typeForUap: string = '';
  errorParsingFile: boolean = false;

  /** Ensemble des checklists par type de production : { TYPE: { thème: [questions] } } */
  allData: any = {};
  /** Types de production proposés (clés de allData). */
  availableTypes: string[] = [];
  /** Type de production actuellement sélectionné. */
  selectedType: string = '';
  /** Contenu (thème -> questions) du type sélectionné (sert à `restartService`). */
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
   * Charge l'ensemble des checklists (par type). Accepte le format imbriqué
   * { TYPE: { thème: [q] } } ou l'ancien format plat { thème: [q] }.
   */
  private setAllData(data: any): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.errorParsingFile = true;
      return false;
    }
    const keys = Object.keys(data);
    if (!keys.length) {
      this.errorParsingFile = true;
      return false;
    }
    // Format plat (ancien) si les valeurs de 1er niveau sont des tableaux.
    const flat = Array.isArray(data[keys[0]]);
    this.allData = flat ? { Checklist: data } : data;
    this.availableTypes = Object.keys(this.allData);
    if (!this.availableTypes.includes(this.selectedType)) {
      this.selectedType = this.availableTypes[0];
    }
    this.setType(this.selectedType);
    return true;
  }

  /** Sélectionne un type de production et (re)construit sa checklist. */
  setType(type: string) {
    if (!this.availableTypes.includes(type)) {
      type = this.availableTypes[0] || '';
    }
    this.selectedType = type;
    this.buildFromData(this.allData[type] || {});
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
        listCheck: items.map((description: string) => ({
          title: '',
          description,
          checked: null,
        })),
      });
    }
    this.errorParsingFile = false;
    return true;
  }

  restartService() {
    this.username = '';
    this.uap = 0;
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
