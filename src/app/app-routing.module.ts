import { ChecklistComponent } from './checklist/checklist.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegisterPageComponent } from './register-page/register-page.component';
import { FormDetailComponent } from './form-detail/form-detail.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';

const routes: Routes = [
  {
    path: 'register',
    component: RegisterPageComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'register',
  },
  {
    path: 'checklist',
    component: ChecklistComponent,
  },
  {
    path: 'form-detail',
    component: FormDetailComponent,
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
