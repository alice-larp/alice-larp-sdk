import * as PouchDB from 'pouchdb';
import * as PouchDBFind from 'pouchdb-find';
import { TSMap } from 'typescript-map';
PouchDB.plugin(PouchDBFind);
import { Event, ModelMetadata } from 'alice-model-engine-api';
import { Token } from 'typedi';
import { Connection } from '../connection';
import { AliceAccount, ShieldValues } from '../models/alice-account';
import { EconomyConstants } from '../models/economy-constants';

export interface ViewModel {
  timestamp: number;
  [key: string]: any;
}

export interface TransactionRequest {
  sender: string;
  receiver: string;
  amount: number;
  description?: string;
}

export interface ProvisionRequest {
  userId: string;
  initialBalance: number;
}

export interface SetBonusRequest {
  userId: string;
  bonusSet: boolean;
}

export interface TransactionDocument extends TransactionRequest {
  timestamp: number;
}

export interface BalancesDocument {
  [key: string]: number;
}

export interface DatabasesContainerInterface {
  // TODO: Make private, provide accessors
  connections: TSMap<string, Connection>;

  createIndices(): Promise<void>;

  accountsDb(): PouchDB.Database<AliceAccount>;
  modelsDb(): PouchDB.Database<{}>;
  metadataDb(): PouchDB.Database<ModelMetadata>;
  viewModelDb(type: string): PouchDB.Database<ViewModel>;
  eventsDb(): PouchDB.Database<Event>;

  economyDb(): PouchDB.Database<TransactionDocument | BalancesDocument | EconomyConstants>;
  objCounterDb(): PouchDB.Database<ShieldValues>;
}

// tslint:disable-next-line:variable-name
export const DatabasesContainerToken = new Token<DatabasesContainerInterface>();

export class DatabasesContainer implements DatabasesContainerInterface {
  public connections = new TSMap<string, Connection>();

  constructor(
    protected _accountsDb: PouchDB.Database<AliceAccount>,
    protected _modelsDb: PouchDB.Database<{}>,
    protected _modelsMetadataDb: PouchDB.Database<ModelMetadata>,
    protected _viewmodelDbs: TSMap<string, PouchDB.Database<ViewModel>>,
    protected _eventsDb: PouchDB.Database<Event>,
    protected _economyDb: PouchDB.Database<TransactionDocument | BalancesDocument | EconomyConstants>,
    protected _objCounterDb: PouchDB.Database<ShieldValues>,
  ) {
      const options = { since: 'now', live: true, include_docs: true, return_docs: false };
      this.viewModelDb('mobile').changes(options)
        .on('change', (change) => {
          if (!change.doc)
            return;

          if (this.connections.has(change.doc._id))
            this.connections.get(change.doc._id).onViewModelUpdate(change.doc);
        });
    }

  public async createIndices(): Promise<void> {
    await this.accountsDb().createIndex({
      index: {fields: ['login']},
    });

    await this.accountsDb().createIndex({
      index: {fields: ['pushToken']},
    });

    await this.economyDb().createIndex({
      index: {fields: ['sender']},
    });
    await this.economyDb().createIndex({
      index: {fields: ['receiver']},
    });
    await this.viewModelDb('mobile').createIndex({
      index: {fields: ['timestamp']},
    });

    await this.modelsDb().createIndex({
      index: {fields: ['location']},
    });
  }

  public accountsDb() { return this._accountsDb; }
  public modelsDb() { return this._modelsDb; }
  public metadataDb() { return this._modelsMetadataDb; }
  public eventsDb() { return this._eventsDb; }
  public viewModelDb(type: string) { return this._viewmodelDbs.get(type); }
  public economyDb() { return this._economyDb; }
  public objCounterDb() { return this._objCounterDb; }
}
