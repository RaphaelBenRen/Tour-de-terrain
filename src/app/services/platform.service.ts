import { Injectable } from '@angular/core';

/**
 * Gère l'état "prêt" de la plateforme Cordova.
 *
 * Bug historique : la caméra (et le plugin File) étaient appelés avant que
 * Cordova ait fini d'initialiser ses plugins natifs -> `getPicture` sur un
 * plugin `undefined`, la caméra ne s'ouvrait jamais.
 *
 * `ready()` résout :
 *  - sur device : quand l'évènement `deviceready` est émis (évènement "sticky"
 *    de Cordova : un listener ajouté après coup est quand même appelé) ;
 *  - dans un navigateur classique : immédiatement.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = new Promise<void>((resolve) => {
      if (this.isCordova()) {
        document.addEventListener('deviceready', () => resolve(), false);
      } else {
        resolve();
      }
    });
  }

  /** Vrai lorsque l'app tourne dans le conteneur natif Cordova (APK). */
  isCordova(): boolean {
    return !!(window as any).cordova;
  }

  /** Résout quand la plateforme est prête à recevoir des appels natifs. */
  ready(): Promise<void> {
    return this.readyPromise;
  }
}
