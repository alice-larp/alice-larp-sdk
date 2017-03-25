﻿import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import { IonicApp, IonicModule } from 'ionic-angular';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { Firebase } from '@ionic-native/firebase';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { ListPage } from '../pages/list/list';
import { ListItem } from '../pages/list-item/list-item';
import { LoginPage } from '../pages/login/login';
import { PlainTextPage } from '../pages/plain-text/plain-text';
import { PlaygroundPage } from '../pages/playground/playground';
import { SelectorPage } from '../pages/selector/selector';
import { TabsPage } from '../pages/tabs/tabs';
import { DataService } from '../services/data.service';
import { FirebaseService } from '../services/firebase.service';
import { TimeService } from '../time/time.service';

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    ListPage,
    ListItem,
    LoginPage,
    PlainTextPage,
    PlaygroundPage,
    SelectorPage,
    TabsPage
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    HttpModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    ListPage,
    LoginPage,
    PlainTextPage,
    PlaygroundPage,
    SelectorPage,
    TabsPage
  ],
  providers: [
    DataService,
    TimeService,
    Firebase,
    FirebaseService,
    BarcodeScanner
  ]
})
export class AppModule {}
