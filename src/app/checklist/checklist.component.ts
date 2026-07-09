import { Component, ElementRef, ViewChild } from '@angular/core';
import { Checklist } from '../checklist';
import { ChecklistService } from '../checklist.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Toast } from '@awesome-cordova-plugins/toast/ngx';
import { Router } from '@angular/router';
import { CameraService } from '../services/camera.service';

@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrls: ['./checklist.component.css'],
})
export class ChecklistComponent {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  popup: boolean = false;
  itemSelected: any;
  dataUrlItemSelected: string = '';
  popupFin: boolean = false;

  // Etat de la caméra web (fallback navigateur, hors APK)
  webCameraActive: boolean = false;
  private webStream: MediaStream | null = null;

  activeChecklist: Checklist = {
    title: 'Sécurité des personnes',
    listCheck: [
      {
        title: 'Port des EPI1',
        checked: null,
        description: 'test',
      },
    ],
  };
  indexCheckList: number = 0;

  constructor(
    public checkListService: ChecklistService,
    private cameraService: CameraService,
    private file: File,
    private router: Router,
    private toast: Toast
  ) {
    // Garde-fou : si (improbable) la liste est vide, on garde la valeur par
    // défaut plutôt que de planter l'affichage.
    this.activeChecklist =
      checkListService.listCheckList[this.indexCheckList] || this.activeChecklist;
  }

  async ngOnInit() {}

  checkItem(event: any, item: any, TrueOrFalse: boolean) {
    if (!TrueOrFalse) {
      this.showPopup(item).then(() => {
        this.popup = true;
      });
    }
    if (item.checked == TrueOrFalse) {
      event.preventDefault();
    }
    item.checked = TrueOrFalse;
  }

  async showPopup(item: any) {
    this.popup = true;
    this.itemSelected = item;
  }

  async closePopup() {
    this.stopWebCamera();
    this.popup = false;
    this.itemSelected = null;
    this.dataUrlItemSelected = '';
  }

  getNextChecklist() {
    // parse the active checklist and check if everything has been checked
    let nbNotChecked = 0;
    this.activeChecklist.listCheck.forEach((item) => {
      if (item.checked == null) {
        nbNotChecked++;
      }
    });
    if (nbNotChecked > 0) {
      this.toast
        .show(nbNotChecked + " lignes n'ont pas été cochées", '2000', 'center')
        .subscribe();
      return;
    }
    if (this.indexCheckList == this.checkListService.listCheckList.length - 1) {
      const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const dayOfWeek = daysOfWeek[new Date().getDay()];
      let actualDate = new Date().toLocaleDateString('fr').replaceAll('/', '-');
      let nameCsvFile =
        dayOfWeek +
        '_' +
        actualDate +
        '_' +
        this.checkListService.username.replaceAll(' ', '') +
        '_UAP' +
        this.checkListService.uap +
        '_' +
        this.checkListService.typeForUap;

      this.checkListService
        .exportToCSV(nameCsvFile)
        .then(() => {
          this.popupFin = true;
        })
        .catch((error) => {
          console.error('Error saving file: ', error);
        });
    } else {
      this.checkListService.listCheckList[this.indexCheckList] = this.activeChecklist;
      this.indexCheckList++;
      this.activeChecklist = this.checkListService.listCheckList[this.indexCheckList];
    }
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

  /**
   * Déclenche la prise de photo.
   *  - Sur APK (natif) : caméra Cordova (après deviceready + permissions).
   *  - Dans un navigateur : caméra web via getUserMedia (fallback dev/test).
   */
  async takePicture() {
    if (this.cameraService.isNative()) {
      try {
        const imageUri = await this.cameraService.takeNativePicture();
        this.dataUrlItemSelected = imageUri;
      } catch (err) {
        console.error('Erreur caméra :', JSON.stringify(err));
        this.toast.show("Impossible d'ouvrir la caméra", '2000', 'center').subscribe();
      }
    } else {
      await this.startWebCamera();
    }
  }

  /** Ouvre le flux caméra dans le navigateur (fallback hors APK). */
  private async startWebCamera() {
    try {
      this.webStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.webCameraActive = true;
      // Le <video> n'est rendu qu'une fois webCameraActive vrai : on branche au tick suivant.
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

  /** Capture l'image courante du flux web dans un dataURL JPEG. */
  captureWebPhoto() {
    const video = this.videoElement?.nativeElement;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.dataUrlItemSelected = canvas.toDataURL('image/jpeg', 0.5);
    this.stopWebCamera();
  }

  /** Coupe le flux caméra web et libère la webcam. */
  stopWebCamera() {
    if (this.webStream) {
      this.webStream.getTracks().forEach((t) => t.stop());
      this.webStream = null;
    }
    this.webCameraActive = false;
  }

  validate() {
    let imageData = this.dataUrlItemSelected;

    // Web (dev/test) : pas de plugin File. La photo est déjà capturée en mémoire.
    if (!this.cameraService.isNative()) {
      this.closePopup();
      return;
    }

    const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayOfWeek = daysOfWeek[new Date().getDay()];
    const actualDate = new Date().toLocaleDateString('fr').replaceAll('/', '-');
    const item = this.itemSelected.description;
    let newFilename =
      dayOfWeek +
      '_' +
      actualDate +
      '_' +
      this.activeChecklist.title.replaceAll(' ', '_') +
      '-' +
      item.replaceAll(' ', '_') +
      '.jpg';
    // Retrait des accents et caractères invalides du nom de fichier
    const newFilenameWithoutAccent = newFilename
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replaceAll("'", '')
      .replaceAll('?', '')
      .replaceAll(':', '')
      .replaceAll('/', 'ou');
    newFilename = newFilenameWithoutAccent;
    let directoryOfImage = imageData.substr(0, imageData.lastIndexOf('/') + 1);
    imageData = imageData.substr(imageData.lastIndexOf('/') + 1);

    this.file
      .moveFile(directoryOfImage, imageData, this.file.externalDataDirectory, newFilename)
      .then(() => {
        this.closePopup();
      })
      .catch((err) => {
        console.log(`Error copying file: ${JSON.stringify(err)}`);
        this.toast.show("Erreur lors de l'enregistrement de la photo", '2000', 'center').subscribe();
      });
  }

  backgroundColor(): string {
    if (this.indexCheckList == 0) {
      return 'secuPersonne';
    } else if (this.indexCheckList == 1) {
      return 'secuProduit';
    } else if (this.indexCheckList == 2) {
      return 'cinqueS';
    } else {
      return 'reglesDor';
    }
  }
}
