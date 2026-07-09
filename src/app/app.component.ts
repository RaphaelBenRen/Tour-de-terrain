import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'tabletteUAP';

  // Le header avec le logo n'est affiché que sur la page de départ (identification).
  // Sur les sections de questions, c'est le bandeau de section qui sert d'en-tête.
  showHeader = true;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = e.urlAfterRedirects;
        this.showHeader = url === '/' || url.startsWith('/register');
      });
  }
}
