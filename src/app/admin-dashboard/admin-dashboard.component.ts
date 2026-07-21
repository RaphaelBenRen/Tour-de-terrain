import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { HistoryService } from '../services/history.service';
import { ChecklistService } from '../checklist.service';
import { ExportService } from '../services/export.service';
import { TdtRecord } from '../checklist';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  tab: 'historique' | 'admins' | 'code' = 'historique';
  records: TdtRecord[] = [];

  // Filtres historique
  typeFilter = '';
  uapFilter = '';
  dateFrom = '';
  dateTo = '';
  search = '';

  // Gestion admins
  newAdminUser = '';
  newAdminPassword = '';
  adminMsg = '';
  pwEdits: { [user: string]: string } = {};

  // Code d'accès formulaire
  newFormCode = '';
  codeMsg = '';
  showFormCode = false;

  // Export
  exporting = false;
  exportMsg = '';

  constructor(
    public admin: AdminService,
    private history: HistoryService,
    private checklist: ChecklistService,
    private exportSvc: ExportService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.admin.loggedIn) {
      this.router.navigate(['/register']);
      return;
    }
    this.history.loadRecords().then(
      (r) => (this.records = (r || []).sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    );
    this.newFormCode = this.admin.getFormAccessCode();
  }

  get availableTypes(): string[] {
    return this.checklist.availableTypes;
  }

  // ---------- Historique ----------
  get filteredRecords(): TdtRecord[] {
    const s = this.search.trim().toLowerCase();
    return this.records.filter(
      (r) =>
        (!this.typeFilter || r.type === this.typeFilter) &&
        (!this.uapFilter || String(r.uap) === this.uapFilter) &&
        (!this.dateFrom || r.date >= this.dateFrom) &&
        (!this.dateTo || r.date <= this.dateTo) &&
        (!s || r.username.toLowerCase().includes(s))
    );
  }

  creneau(r: TdtRecord): string {
    const d = new Date(r.savedAt);
    return r.slot === 'aprem' || (!r.slot && d.getHours() >= 13) ? 'Après-midi' : 'Matin';
  }

  heure(r: TdtRecord): string {
    const d = new Date(r.savedAt);
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  openDetail(r: TdtRecord) {
    this.history.selectedRecord = r;
    this.router.navigate(['/form-detail']);
  }

  resetFilters() {
    this.typeFilter = '';
    this.uapFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.search = '';
  }

  // ---------- Export ----------
  exportAll() {
    this.doExport(this.records, 'TDT_export_toutes_tentatives.csv');
  }

  exportFiltered() {
    this.doExport(this.filteredRecords, 'TDT_export_filtre.csv');
  }

  private doExport(recs: TdtRecord[], fileName: string) {
    if (!recs.length) {
      this.exportMsg = 'Aucune tentative à exporter.';
      return;
    }
    this.exporting = true;
    this.exportMsg = '';
    const csv = this.exportSvc.buildCsv(recs);
    this.exportSvc
      .saveCsv(fileName, csv)
      .then((path) => (this.exportMsg = '✓ Exporté dans : ' + path))
      .catch((e) => (this.exportMsg = 'Erreur export : ' + e))
      .finally(() => (this.exporting = false));
  }

  // ---------- Gestion admins ----------
  addAdmin() {
    const res = this.admin.addAdmin(this.newAdminUser, this.newAdminPassword);
    this.adminMsg = res.ok ? 'Admin ajouté.' : res.error || '';
    if (res.ok) {
      this.newAdminUser = '';
      this.newAdminPassword = '';
    }
  }

  changePw(user: string) {
    const res = this.admin.changeAdminPassword(user, this.pwEdits[user]);
    this.adminMsg = res.ok ? 'Mot de passe de ' + user + ' modifié.' : res.error || '';
    if (res.ok) this.pwEdits[user] = '';
  }

  removeAdmin(user: string) {
    const res = this.admin.removeAdmin(user);
    this.adminMsg = res.ok ? 'Admin ' + user + ' supprimé.' : res.error || '';
  }

  // ---------- Code d'accès formulaire ----------
  saveCode() {
    const res = this.admin.setFormAccessCode(this.newFormCode);
    this.codeMsg = res.ok ? '✓ Code enregistré.' : res.error || '';
  }

  // ---------- Divers ----------
  logout() {
    this.admin.logout();
    this.router.navigate(['/register']);
  }
}
