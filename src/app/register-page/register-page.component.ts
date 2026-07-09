import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ChecklistService } from '../checklist.service';

@Component({
  selector: 'app-register-page',
  templateUrl: './register-page.component.html',
  styleUrls: ['./register-page.component.css'],
})
export class RegisterPageComponent {
  username: string = '';
  uap: string = '1';
  typeForUap: string = '';

  constructor(
    private router: Router,
    public checklistService: ChecklistService // public pour binder les types + l'erreur de lecture
  ) {
    // Type de production par défaut = premier type disponible.
    this.typeForUap = checklistService.availableTypes[0] || '';
  }

  registerUser() {
    const name = (this.username || '').trim();
    const validUap = ['1', '2', '3'].includes(this.uap.toString());
    // On démarre dès qu'un nom, un UAP valide et un type sont renseignés.
    if (validUap && name.length > 0 && this.typeForUap) {
      this.checklistService.username = name;
      this.checklistService.uap = parseInt(this.uap, 10);
      this.checklistService.typeForUap = this.typeForUap;
      // Charge la checklist correspondant au type choisi.
      this.checklistService.setType(this.typeForUap);
      this.router.navigate(['checklist']);
    }
  }
}
