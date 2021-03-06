import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { Splashscreen, StatusBar } from 'ionic-native';

import { LoginPage } from '../pages/login';

@Component({
  template: `<ion-nav [root]="rootPage"></ion-nav>`,
})
export class MyApp {
  public rootPage = null;

  constructor(platform: Platform) {
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      StatusBar.styleDefault();
      Splashscreen.hide();
      this.rootPage = LoginPage;

      platform.registerBackButtonAction(() => {
        // Do nothing. Prevents app from exiting.
      });
    })
  }
}
