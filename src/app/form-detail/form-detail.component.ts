import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HistoryService } from '../services/history.service';
import { TdtRecord, isAnswerCorrect } from '../checklist';

@Component({
  selector: 'app-form-detail',
  templateUrl: './form-detail.component.html',
  styleUrls: ['./form-detail.component.css'],
})
export class FormDetailComponent implements OnInit {
  record: TdtRecord | null = null;
  /** dataURL des photos, indexées par nom de fichier. */
  photoUrls: { [filename: string]: string } = {};

  constructor(private history: HistoryService, private router: Router) {}

  ngOnInit() {
    this.record = this.history.selectedRecord;
    if (!this.record) {
      this.router.navigate(['/register']);
      return;
    }
    // Précharge les photos en dataURL pour l'affichage.
    for (const cl of this.record.checklists) {
      for (const it of cl.listCheck) {
        (it.photos || []).forEach((fn) => {
          if (fn.startsWith('data:')) {
            // Web (dev) : la photo est déjà un dataURL.
            this.photoUrls[fn] = fn;
          } else {
            this.history.getPhotoDataUrl(fn).then((url) => {
              if (url) this.photoUrls[fn] = url;
            });
          }
        });
      }
    }
  }

  /** La réponse de l'opérateur correspond-elle au corrigé ? */
  isCorrect(item: { checked: boolean | null; expected?: boolean }): boolean {
    return isAnswerCorrect(item);
  }

  /** Réponse attendue (corrigé) en clair. */
  expectedLabel(item: { expected?: boolean }): string {
    return item.expected === false ? 'Non conforme' : 'Conforme';
  }

  back() {
    this.history.selectedRecord = null;
    this.router.navigate(['/register']);
  }
}
