import { Injectable } from '@angular/core';
import { Camera, CameraOptions } from '@awesome-cordova-plugins/camera/ngx';
import { PlatformService } from './platform.service';

/**
 * Encapsule la prise de photo, en distinguant :
 *  - le natif Cordova (APK Android) : plugin `cordova-plugin-camera` ;
 *  - le web (navigateur, dev/test) : `getUserMedia` (voir composant checklist).
 *
 * La correction du bug caméra repose sur 3 points :
 *  1. attendre `deviceready` avant tout appel natif (PlatformService) ;
 *  2. permissions déclarées dans config.xml (CAMERA / READ_MEDIA_IMAGES) ;
 *  3. AndroidX activé (requis par cordova-plugin-camera 7 sur Android 13+/16).
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  constructor(private camera: Camera, private platform: PlatformService) {}

  /** Prise de photo native. Retourne l'URI du fichier image en cache. */
  async takeNativePicture(): Promise<string> {
    await this.platform.ready();

    const options: CameraOptions = {
      quality: 30,
      destinationType: this.camera.DestinationType.FILE_URI,
      mediaType: this.camera.MediaType.PICTURE,
      encodingType: this.camera.EncodingType.JPEG,
      sourceType: this.camera.PictureSourceType.CAMERA,
      cameraDirection: this.camera.Direction.BACK,
      saveToPhotoAlbum: false,
      correctOrientation: true,
    };

    return this.camera.getPicture(options);
  }

  isNative(): boolean {
    return this.platform.isCordova();
  }
}
