import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { RegisterPageComponent } from './register-page/register-page.component';
import { ChecklistComponent } from './checklist/checklist.component';
import { FormDetailComponent } from './form-detail/form-detail.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { FormsModule } from '@angular/forms';
import { Camera } from '@awesome-cordova-plugins/camera/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Toast } from '@awesome-cordova-plugins/toast/ngx';

@NgModule({
  declarations: [
    AppComponent,
    RegisterPageComponent,
    ChecklistComponent,
    FormDetailComponent,
    AdminDashboardComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
    FormsModule,
  ],
  providers: [Camera, File, Toast],
  bootstrap: [AppComponent],
})
export class AppModule { }
