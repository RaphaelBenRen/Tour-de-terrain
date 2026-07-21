import { Injectable } from '@angular/core';
import { TdtRecord, isAnswerCorrect } from '../checklist';

/**
 * Construit un CSV consolidé (1 ligne par réponse) de toutes les tentatives et
 * l'enregistre dans le dossier public "Téléchargements/TDT" (accessible en USB).
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly SEP = ';';

  /** CSV tidy : 1 ligne par question/réponse, prêt pour Excel / Dataiku. */
  buildCsv(records: TdtRecord[]): string {
    const header = [
      'Date', 'Heure', 'Creneau', 'Operateur', 'UAP', 'Type',
      'Theme', 'Question', 'Reponse', 'Attendu', 'Resultat', 'Photos',
    ];
    const rows: string[] = [header.join(this.SEP)];

    for (const r of records) {
      const d = new Date(r.savedAt);
      const heure = this.pad(d.getHours()) + ':' + this.pad(d.getMinutes());
      const creneau =
        r.slot === 'aprem' || (!r.slot && d.getHours() >= 13) ? 'Apres-midi' : 'Matin';

      for (const cl of r.checklists) {
        for (const it of cl.listCheck) {
          const reponse = it.checked ? 'Conforme' : 'Non conforme';
          const attendu = it.expected === false ? 'Non conforme' : 'Conforme';
          const resultat = isAnswerCorrect(it) ? 'Juste' : 'Faux';
          const photos = (it.photos || []).join(' | ');
          rows.push(
            [
              r.date, heure, creneau, r.username, 'UAP' + r.uap, r.type,
              cl.title, it.description || '', reponse, attendu, resultat, photos,
            ]
              .map((v) => this.esc(v))
              .join(this.SEP)
          );
        }
      }
    }
    // BOM UTF-8 pour qu'Excel lise correctement les accents.
    return String.fromCharCode(0xfeff) + rows.join('\r\n');
  }

  /**
   * Enregistre le CSV dans Téléchargements/TDT (natif) ou le télécharge (web).
   * Retourne le chemin/emplacement.
   */
  saveCsv(fileName: string, csv: string): Promise<string> {
    const ms = (window as any).cordova?.plugins?.tdtMediaStore;
    if (ms && ms.saveToDownloads) {
      return new Promise<string>((resolve, reject) => {
        ms.saveToDownloads(fileName, 'text/csv', csv, resolve, reject);
      });
    }
    // Fallback navigateur (dev) : téléchargement classique.
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return Promise.resolve('téléchargement navigateur');
    } catch (e: any) {
      return Promise.reject(e?.message || 'Erreur');
    }
  }

  private pad(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  private esc(v: any): string {
    let s = v === null || v === undefined ? '' : String(v);
    s = s.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    if (s.indexOf(this.SEP) >= 0 || s.indexOf('"') >= 0) {
      s = '"' + s + '"';
    }
    return s;
  }
}
