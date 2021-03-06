import { Component } from '@angular/core';
import { Brightness } from '@ionic-native/brightness';
import { encode } from 'deus-qr-lib/lib/qr';
import { QrType } from 'deus-qr-lib/lib/qr.type';
import { NavParams } from 'ionic-angular';
import { GlobalConfig } from '../config';
import { MonotonicTimeService } from '../services/monotonic-time.service';

export class BillPageData {
  public amount: number;
  public receiverAccount: string;
  public description: string;
}

@Component({
  selector: 'page-bill',
  templateUrl: 'bill.html',
})
export class BillPage {
  public qrContent = '';
  public billPageData: BillPageData;

  constructor(navParams: NavParams,
              private _clock: MonotonicTimeService,
              private _brightness: Brightness) {
    this.billPageData = navParams.data.value;
    this.qrContent = encode({
      type: QrType.Bill, kind: 0,
      // TODO: add helper for expiring QR generation
      validUntil: (_clock.getUnixTimeMs() + GlobalConfig.transactionQrLifespan) / 1000,
      payload: `${this.billPageData.receiverAccount},${this.billPageData.amount},${this.billPageData.description}`,
    });
  }

  public ionViewDidEnter() {
    this._brightness.setBrightness(1);
    this._brightness.setKeepScreenOn(true);
  }

  public ionViewWillLeave() {
    this._brightness.setBrightness(-1);
    this._brightness.setKeepScreenOn(false);
  }
}
