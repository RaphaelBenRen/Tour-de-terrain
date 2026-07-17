import { Component, ElementRef, ViewChild } from '@angular/core';
import { Checklist, TdtRecord, isAnswerCorrect } from '../checklist';
import { ChecklistService } from '../checklist.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Toast } from '@awesome-cordova-plugins/toast/ngx';
import { Router } from '@angular/router';
import { CameraService } from '../services/camera.service';
import { HistoryService } from '../services/history.service';

@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrls: ['./checklist.component.css'],
})
export class ChecklistComponent {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  popup: boolean = false;
  itemSelected: any;
  /** Photos capturées pour l'item courant (URI fichier en natif, dataURL en web). */
  photosForItem: string[] = [];
  popupFin: boolean = false;

  // Etat de la caméra web (fallback navigateur, hors APK)
  webCameraActive: boolean = false;
  private webStream: MediaStream | null = null;

  activeChecklist: Checklist = {
    title: 'Sécurité des personnes',
    listCheck: [{ title: 'Port des EPI1', checked: null, description: 'test' }],
  };
  indexCheckList: number = 0;

  private readonly daysOfWeek = [
    'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
  ];

  constructor(
    public checkListService: ChecklistService,
    private cameraService: CameraService,
    private history: HistoryService,
    private file: File,
    private router: Router,
    private toast: Toast
  ) {
    // Garde-fou : si (improbable) la liste est vide, on garde la valeur par défaut.
    this.activeChecklist =
      checkListService.listCheckList[this.indexCheckList] || this.activeChecklist;
  }

  async ngOnInit() {}

  checkItem(event: any, item: any, TrueOrFalse: boolean) {
    if (!TrueOrFalse) {
      this.showPopup(item);
    }
    if (item.checked == TrueOrFalse) {
      event.preventDefault();
    }
    item.checked = TrueOrFalse;
  }

  showPopup(item: any) {
    this.itemSelected = item;
    this.photosForItem = [];
    this.popup = true;
  }

  closePopup() {
    this.stopWebCamera();
    this.popup = false;
    this.itemSelected = null;
    this.photosForItem = [];
  }

  getNextChecklist() {
    // Vérifie que tout est coché sur la section courante
    let nbNotChecked = 0;
    this.activeChecklist.listCheck.forEach((item) => {
      if (item.checked == null) nbNotChecked++;
    });
    if (nbNotChecked > 0) {
      this.toast.show(nbNotChecked + " lignes n'ont pas été cochées", '2000', 'center').subscribe();
      return;
    }

    if (this.indexCheckList == this.checkListService.listCheckList.length - 1) {
      // Dernière section : on enregistre le CSV puis le TDT (historique) et on affiche la fin.
      this.checkListService.listCheckList[this.indexCheckList] = this.activeChecklist;
      const dayOfWeek = this.daysOfWeek[new Date().getDay()];
      const actualDate = new Date().toLocaleDateString('fr').replaceAll('/', '-');
      const nameCsvFile =
        dayOfWeek + '_' + actualDate + '_' +
        this.checkListService.username.replaceAll(' ', '') +
        '_UAP' + this.checkListService.uap + '_' + this.checkListService.typeForUap;

      this.checkListService
        .exportToCSV(nameCsvFile)
        .then(() => this.saveRecord())
        .then(() => (this.popupFin = true))
        .catch((error) => {
          console.error('Error saving file: ', error);
          this.saveRecord().finally(() => (this.popupFin = true));
        });
    } else {
      this.checkListService.listCheckList[this.indexCheckList] = this.activeChecklist;
      this.indexCheckList++;
      this.activeChecklist = this.checkListService.listCheckList[this.indexCheckList];
    }
  }

  /** Enregistre le TDT complété dans l'historique local (pour le calendrier). */
  private saveRecord(): Promise<any> {
    const now = new Date();
    const dateIso = this.toIsoDate(now);
    const type = this.checkListService.typeForUap;
    const username = this.checkListService.username;
    const checklists: Checklist[] = JSON.parse(JSON.stringify(this.checkListService.listCheckList));
    // Juste = la réponse correspond au corrigé (item.expected). Tout juste -> pastille verte.
    const allCorrect = checklists.every((cl) => cl.listCheck.every((it) => isAnswerCorrect(it)));
    const record: TdtRecord = {
      id: this.history.buildId(type, dateIso, username),
      savedAt: now.toISOString(),
      date: dateIso,
      dayName: this.daysOfWeek[now.getDay()],
      slot: now.getHours() < 13 ? 'matin' : 'aprem',
      username,
      uap: this.checkListService.uap,
      type,
      allCorrect,
      checklists,
    };
    return this.history.saveRecord(record).catch((err) => {
      console.log('Erreur enregistrement TDT :', JSON.stringify(err));
    });
  }

  private toIsoDate(d: Date): string {
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  getLastChecklist() {
    this.checkListService.listCheckList[this.indexCheckList] = this.activeChecklist;
    this.indexCheckList--;
    this.activeChecklist = this.checkListService.listCheckList[this.indexCheckList];
  }

  restartApp() {
    this.checkListService.restartService();
    this.indexCheckList = 0;
    this.activeChecklist = this.checkListService.listCheckList[this.indexCheckList];
    this.popupFin = false;
    this.router.navigate(['/register']);
  }

  /** Prise de photo (on peut en prendre plusieurs). */
  async takePicture() {
    if (this.cameraService.isNative()) {
      try {
        const uri = await this.cameraService.takeNativePicture();
        this.photosForItem.push(uri);
      } catch (err) {
        console.error('Erreur caméra :', JSON.stringify(err));
        this.toast.show("Impossible d'ouvrir la caméra", '2000', 'center').subscribe();
      }
    } else {
      await this.startWebCamera();
    }
  }

  /** Supprime une photo de la liste avant validation. */
  removePhoto(i: number) {
    this.photosForItem.splice(i, 1);
  }

  private async startWebCamera() {
    try {
      this.webStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.webCameraActive = true;
      setTimeout(() => {
        if (this.videoElement && this.webStream) {
          this.videoElement.nativeElement.srcObject = this.webStream;
          this.videoElement.nativeElement.play().catch(() => {});
        }
      });
    } catch (err) {
      console.error('Erreur getUserMedia :', err);
      this.toast.show("Impossible d'accéder à la caméra", '2000', 'center').subscribe();
    }
  }

  captureWebPhoto() {
    const video = this.videoElement?.nativeElement;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.photosForItem.push(canvas.toDataURL('image/jpeg', 0.5));
    this.stopWebCamera();
  }

  stopWebCamera() {
    if (this.webStream) {
      this.webStream.getTracks().forEach((t) => t.stop());
      this.webStream = null;
    }
    this.webCameraActive = false;
  }

  validate() {
    if (this.photosForItem.length === 0) {
      this.closePopup();
      return;
    }

    // Web (dev/test) : pas de plugin File, on garde les dataURLs en mémoire.
    if (!this.cameraService.isNative()) {
      this.itemSelected.photos = [...this.photosForItem];
      this.closePopup();
      return;
    }

    // Natif : on déplace chaque photo vers le dossier de l'app, en la numérotant.
    const base = this.buildPhotoBaseName();
    const saved: string[] = [];
    const moves = this.photosForItem.map((uri, i) => {
      const dir = uri.substr(0, uri.lastIndexOf('/') + 1);
      const name = uri.substr(uri.lastIndexOf('/') + 1);
      const target = `${base}_${i + 1}.jpg`;
      return this.file
        .moveFile(dir, name, this.file.externalDataDirectory, target)
        .then(() => saved.push(target))
        .catch((err) => console.log('Erreur copie photo :', JSON.stringify(err)));
    });

    Promise.all(moves).then(() => {
      this.itemSelected.photos = saved;
      this.closePopup();
    });
  }

  private buildPhotoBaseName(): string {
    const dayOfWeek = this.daysOfWeek[new Date().getDay()];
    const actualDate = new Date().toLocaleDateString('fr').replaceAll('/', '-');
    const item = this.itemSelected.description || '';
    const base =
      dayOfWeek + '_' + actualDate + '_' +
      this.activeChecklist.title.replaceAll(' ', '_') + '-' + item.replaceAll(' ', '_');
    return base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replaceAll("'", '')
      .replaceAll('?', '')
      .replaceAll(':', '')
      .replaceAll('/', 'ou');
  }

  backgroundColor(): string {
    if (this.indexCheckList == 0) return 'secuPersonne';
    else if (this.indexCheckList == 1) return 'secuProduit';
    else if (this.indexCheckList == 2) return 'cinqueS';
    else return 'reglesDor';
  }
}
