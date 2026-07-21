import { Injectable } from '@angular/core';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { PlatformService } from './platform.service';

export interface AdminAccount {
  user: string;
  password: string;
}

interface AdminConfig {
  admins: AdminAccount[];
  formAccessCode: string;
}

const CONFIG_FILE = 'admin_config.json';
const DEFAULT_CONFIG: AdminConfig = {
  admins: [{ user: 'admin', password: '1468' }],
  formAccessCode: '1468',
};

/**
 * Gère les comptes admin et le code d'accès aux formulaires (stockés en clair
 * localement dans `admin_config.json`). App kiosque : sécurité légère assumée.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private config: AdminConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  /** Session admin en cours (réinitialisée à chaque lancement de l'app). */
  loggedIn = false;
  currentUser = '';

  constructor(private file: File, private platform: PlatformService) {
    this.platform.ready().then(() => this.load());
  }

  // ---------- Persistance ----------
  private load(): Promise<void> {
    return this.file
      .readAsText(this.file.externalDataDirectory, CONFIG_FILE)
      .then((txt) => {
        const data = JSON.parse(txt);
        if (data && Array.isArray(data.admins) && data.admins.length) {
          this.config = {
            admins: data.admins,
            formAccessCode: data.formAccessCode || '1468',
          };
        }
      })
      .catch(() => {
        /* pas de config : on garde les valeurs par défaut (admin/1468) */
      });
  }

  private save(): Promise<any> {
    return this.platform.ready().then(() => {
      const blob = new Blob([JSON.stringify(this.config)], { type: 'application/json' });
      return this.file.writeFile(this.file.externalDataDirectory, CONFIG_FILE, blob, {
        replace: true,
      });
    });
  }

  // ---------- Connexion ----------
  login(user: string, password: string): boolean {
    const u = (user || '').trim();
    const found = this.config.admins.find(
      (a) => a.user.toLowerCase() === u.toLowerCase() && a.password === password
    );
    if (found) {
      this.loggedIn = true;
      this.currentUser = found.user;
      return true;
    }
    return false;
  }

  logout() {
    this.loggedIn = false;
    this.currentUser = '';
  }

  // ---------- Gestion des admins ----------
  get admins(): AdminAccount[] {
    return this.config.admins;
  }

  addAdmin(user: string, password: string): { ok: boolean; error?: string } {
    const u = (user || '').trim();
    if (!u || !password) return { ok: false, error: 'Utilisateur et mot de passe requis.' };
    if (this.config.admins.some((a) => a.user.toLowerCase() === u.toLowerCase())) {
      return { ok: false, error: 'Cet utilisateur existe déjà.' };
    }
    this.config.admins.push({ user: u, password });
    this.save();
    return { ok: true };
  }

  changeAdminPassword(user: string, newPassword: string): { ok: boolean; error?: string } {
    if (!newPassword) return { ok: false, error: 'Mot de passe requis.' };
    const admin = this.config.admins.find((a) => a.user === user);
    if (!admin) return { ok: false, error: 'Admin introuvable.' };
    admin.password = newPassword;
    this.save();
    return { ok: true };
  }

  removeAdmin(user: string): { ok: boolean; error?: string } {
    if (this.config.admins.length <= 1) {
      return { ok: false, error: 'Impossible de supprimer le dernier admin.' };
    }
    this.config.admins = this.config.admins.filter((a) => a.user !== user);
    if (this.currentUser === user) this.logout();
    this.save();
    return { ok: true };
  }

  // ---------- Code d'accès formulaire ----------
  getFormAccessCode(): string {
    return this.config.formAccessCode || '1468';
  }

  setFormAccessCode(code: string): { ok: boolean; error?: string } {
    const c = (code || '').trim();
    if (!c) return { ok: false, error: 'Code requis.' };
    this.config.formAccessCode = c;
    this.save();
    return { ok: true };
  }
}
