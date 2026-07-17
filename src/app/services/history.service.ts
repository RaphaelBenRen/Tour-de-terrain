import { Injectable } from '@angular/core';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { PlatformService } from './platform.service';
import { TdtRecord } from '../checklist';

/**
 * Gère l'historique local des TDT complétés (fichiers `record_*.json` dans le
 * dossier privé de l'app). Sert au calendrier de la page d'accueil et à la
 * consultation en lecture seule des réponses.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  /** Enregistrement sélectionné pour affichage détaillé (lecture seule). */
  selectedRecord: TdtRecord | null = null;

  constructor(private file: File, private platform: PlatformService) {}

  private slug(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /** Construit un identifiant déterministe : un TDT par (type, date, opérateur). */
  buildId(type: string, dateIso: string, username: string): string {
    return `${this.slug(type)}_${dateIso}_${this.slug(username)}`;
  }

  /** Enregistre (ou remplace) un TDT complété. */
  saveRecord(record: TdtRecord): Promise<any> {
    return this.platform.ready().then(() => {
      const blob = new Blob([JSON.stringify(record)], { type: 'application/json' });
      return this.file.writeFile(
        this.file.externalDataDirectory,
        'record_' + record.id + '.json',
        blob,
        { replace: true }
      );
    });
  }

  /** Charge tous les TDT enregistrés sur la tablette. */
  loadRecords(): Promise<TdtRecord[]> {
    return this.platform.ready().then(
      () =>
        new Promise<TdtRecord[]>((resolve) => {
          const dir = this.file.externalDataDirectory;
          const resolver = (window as any).resolveLocalFileSystemURL;
          if (!dir || !resolver) {
            resolve([]);
            return;
          }
          resolver(
            dir,
            (dirEntry: any) => {
              const reader = dirEntry.createReader();
              reader.readEntries(
                (entries: any[]) => {
                  const files = entries.filter(
                    (e) => e.isFile && e.name.startsWith('record_') && e.name.endsWith('.json')
                  );
                  Promise.all(files.map((f) => this.readJson(f.name))).then((records) => {
                    resolve(records.filter((r): r is TdtRecord => !!r));
                  });
                },
                () => resolve([])
              );
            },
            () => resolve([])
          );
        })
    );
  }

  private readJson(name: string): Promise<TdtRecord | null> {
    return this.file
      .readAsText(this.file.externalDataDirectory, name)
      .then((txt) => {
        try {
          return JSON.parse(txt) as TdtRecord;
        } catch {
          return null;
        }
      })
      .catch(() => null);
  }

  /** Lit une photo enregistrée et la renvoie en dataURL (pour l'affichage). */
  getPhotoDataUrl(filename: string): Promise<string> {
    return this.platform
      .ready()
      .then(() => this.file.readAsDataURL(this.file.externalDataDirectory, filename))
      .catch(() => '');
  }
}
