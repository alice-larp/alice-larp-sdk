import { Injectable } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { Push, PushObject, PushOptions } from '@ionic-native/push';
import { ToastController } from 'ionic-angular';
import { Subscription } from 'rxjs/Rx';
import { GlobalConfig } from '../config';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { LoggingService } from './logging.service';
import { ILoginListener } from './login-listener';

@Injectable()
export class FirebaseService implements ILoginListener {
  private _pushObject: PushObject = null;

  private _tokenSubscription: Subscription = null;
  private _notificationSubscription: Subscription = null;
  private _errorSubscription: Subscription = null;

  constructor(private _push: Push,
              private _logging: LoggingService,
              private _dataService: DataService,
              private _authService: AuthService,
              private _appVersion: AppVersion,
              private _toastCtrl: ToastController) {
    _authService.addListener(this);
    this._logging.debug('FirebaseService constructor run');
  }

  public onSuccessfulLogin(_userId: string) {
    // Hack: we use AppVersion to determine if we are running in browser
    this._appVersion.getVersionNumber().then(() => {
      this._logging.info('Subscribing to Firebase');

      const options: PushOptions = {
        android: {
          senderID: '786784916655',
          topics: ['all'],
          sound: true,
          vibrate: true,
        },
        ios: {
          alert: true,
          sound: true,
          fcmSandbox: !GlobalConfig.useProductionAPNSChannel,
          topics: ['all'],
        },
      };

      this._pushObject = this._push.init(options);

      this._push.hasPermission()
        .then((data) => {
          this._logging.debug('Has permission? Data: ' + JSON.stringify(data));
        })
        .then(() => this._logging.debug('Got push permission!'))
        .catch(() => this._logging.warning('Did NOT get push permission!'));

      this._pushObject.on('notification').subscribe(async (notification: any) => {
        this._logging.debug('Got notification: ' + JSON.stringify(notification));
        if (notification.additionalData && notification.additionalData.refresh)
          await this._dataService.pushEvent('pushReceived', notification.additionalData);

        if (notification.title || notification.message) {
          const message: string = (notification.title ? notification.title + '. ' : '') + notification.message;
          this._toastCtrl.create({
            message,
            duration: 8000,
            position: 'middle',
            showCloseButton: true,
            closeButtonText: 'Ok',
            dismissOnPageChange: false,
          }).present();
        }

        this._pushObject.finish();
      });

      this._tokenSubscription = this._pushObject.on('registration').subscribe((token: any) => {
        this._logging.debug(`The token is ${token}`);
        this._dataService.pushEvent('tokenUpdated', { token });
      });

      this._tokenSubscription = this._pushObject.on('error').subscribe((error: any) => {
        this._logging.error(`Got error from push plugin: ${error}`);
      });
    })
      .catch(() => console.log('Not subscribing to push notifications as running in browser'));
  }

  public onLogout() {
    if (this._tokenSubscription) {
      this._tokenSubscription.unsubscribe();
      this._tokenSubscription = null;
    }
    if (this._notificationSubscription) {
      this._notificationSubscription.unsubscribe();
      this._notificationSubscription = null;
    }
    if (this._errorSubscription) {
      this._errorSubscription.unsubscribe();
      this._errorSubscription = null;
    }
    if (this._pushObject) {
      this._pushObject.unregister();
      this._pushObject = null;
    }
  }
}
