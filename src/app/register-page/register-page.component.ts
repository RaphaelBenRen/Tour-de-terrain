import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChecklistService } from '../checklist.service';
import { HistoryService } from '../services/history.service';
import { AdminService } from '../services/admin.service';
import { TdtRecord } from '../checklist';

interface WeekDay {
  name: string;
  date: Date;
  iso: string;
  label: string;
}

@Component({
  selector: 'app-register-page',
  templateUrl: './register-page.component.html',
  styleUrls: ['./register-page.component.css'],
})
export class RegisterPageComponent implements OnInit {
  username: string = '';
  uap: string = '1';
  typeForUap: string = '';

  // --- Historique / calendrier ---
  records: TdtRecord[] = [];
  weekStart: Date = this.getMonday(new Date());

  // --- Contrôle d'accès aux réponses (code configurable) ---
  showPasswordModal = false;
  passwordValue = '';
  passwordError = false;
  private pendingRecord: TdtRecord | null = null;

  // --- Connexion admin ---
  showAdminModal = false;
  adminUser = '';
  adminPassword = '';
  adminError = false;

  private readonly dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

  constructor(
    private router: Router,
    public checklistService: ChecklistService,
    private history: HistoryService,
    private admin: AdminService
  ) {
    this.typeForUap = checklistService.availableTypes[0] || '';
  }

  ngOnInit() {
    this.history.loadRecords().then((r) => (this.records = r || []));
  }

  // ---------- Démarrage du TDT ----------
  registerUser() {
    const name = (this.username || '').trim();
    const validUap = ['1', '2', '3'].includes(this.uap.toString());
    if (validUap && name.length > 0 && this.typeForUap) {
      this.checklistService.username = name;
      this.checklistService.uap = parseInt(this.uap, 10);
      this.checklistService.typeForUap = this.typeForUap;
      this.checklistService.setType(this.typeForUap);
      this.router.navigate(['checklist']);
    }
  }

  // ---------- Calendrier ----------
  get weekDays(): WeekDay[] {
    return this.dayNames.map((name, i) => {
      const d = new Date(this.weekStart);
      d.setDate(this.weekStart.getDate() + i);
      return { name, date: d, iso: this.toIso(d), label: this.shortLabel(d) };
    });
  }

  get weekRangeLabel(): string {
    const days = this.weekDays;
    return `${days[0].label} → ${days[4].label}`;
  }

  /** TDT d'un jour et d'un créneau (matin / après-midi) pour le type sélectionné. */
  recordsForDaySlot(iso: string, slot: 'matin' | 'aprem'): TdtRecord[] {
    return this.records
      .filter((r) => r.type === this.typeForUap && r.date === iso && this.slotOf(r) === slot)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  /** Créneau d'un TDT : 'matin' (00h–13h) sinon 'aprem'. */
  private slotOf(r: TdtRecord): 'matin' | 'aprem' {
    if (r.slot === 'matin' || r.slot === 'aprem') return r.slot;
    const h = new Date(r.savedAt).getHours();
    return h < 13 ? 'matin' : 'aprem';
  }

  prevWeek() {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() - 7);
    this.weekStart = d;
  }

  nextWeek() {
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + 7);
    this.weekStart = d;
  }

  // ---------- Accès aux réponses (code 1468) ----------
  openRecord(record: TdtRecord) {
    this.pendingRecord = record;
    this.passwordValue = '';
    this.passwordError = false;
    this.showPasswordModal = true;
  }

  cancelPassword() {
    this.showPasswordModal = false;
    this.pendingRecord = null;
    this.passwordValue = '';
    this.passwordError = false;
  }

  submitPassword() {
    if (this.passwordValue === this.admin.getFormAccessCode() && this.pendingRecord) {
      this.history.selectedRecord = this.pendingRecord;
      this.showPasswordModal = false;
      this.router.navigate(['/form-detail']);
    } else {
      this.passwordError = true;
      this.passwordValue = '';
    }
  }

  // ---------- Connexion admin ----------
  openAdminLogin() {
    this.adminUser = '';
    this.adminPassword = '';
    this.adminError = false;
    this.showAdminModal = true;
  }

  cancelAdminLogin() {
    this.showAdminModal = false;
    this.adminError = false;
  }

  submitAdminLogin() {
    if (this.admin.login(this.adminUser, this.adminPassword)) {
      this.showAdminModal = false;
      this.router.navigate(['/admin']);
    } else {
      this.adminError = true;
      this.adminPassword = '';
    }
  }

  // ---------- Utilitaires date ----------
  private getMonday(d: Date): Date {
    const day = d.getDay(); // 0 = dimanche
    const diff = day === 0 ? -6 : 1 - day;
    const m = new Date(d);
    m.setDate(d.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m;
  }

  private toIso(d: Date): string {
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private shortLabel(d: Date): string {
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  }
}
