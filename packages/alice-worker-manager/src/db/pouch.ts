import { clone, isNil } from 'lodash';
import * as Pouch from 'pouchdb';
import * as PouchDBFind from 'pouchdb-find';
Pouch.plugin(PouchDBFind);
import { Config } from '../config';
import { DBConnectorInterface, DBInterface, Document, FilterParams, ID, PutableDocument } from './interface';

export class PouchConnector implements DBConnectorInterface {
  private cache: { [name: string]: PouchDb } = {};

  constructor(private _config: Config) {}

  public use(name: string): DBInterface {
    if (this.cache[name]) return this.cache[name];
    return this.cache[name] = new PouchDb(this._config.db.url + name, this._config.db.adapter);
  }
}

export class PouchDb implements DBInterface {
  // TODO(aeremin): Rework import code and make private
  public db: PouchDB.Database;

  constructor(databaseUrl: string, adapter?: string) {
    this.db = new Pouch(databaseUrl, { adapter });
  }

  public get(id: ID, params: any = {}) {
    return this.db.get(id, params);
  }

  public async getOrNull(id: ID, params: any): Promise<Document | null> {
    try {
      return await this.get(id, params);
    } catch (e) {
      if (e.status == 404) {
        return null;
      } else {
        throw e;
      }
    }
  }

  public list(params?: any): Promise<any> {
    return this.db.allDocs(params);
  }

  public put(doc: PutableDocument) {
    if (!isNil(doc._id)) {
      return this.db.put(doc);
    } else {
      return this.db.post(doc);
    }
  }

  public remove(id: ID, rev: string) {
    if (isNil(id) || isNil(rev)) {
      return Promise.reject(new Error('Document id or revision not defined in remove'));
    }

    return this.db.remove({ _id: id, _rev: rev });
  }

  public follow(params: FilterParams): void {
    const { onChange, ...otherParams } = params;
    let feed = this.db.changes({...otherParams, live: true, return_docs: false});

    if (onChange) {
      feed = feed.on('change', onChange);
    }
    // TODO(aeremin): Handle 'error', e.g. database connection loss
  }

  public async destroy(): Promise<void> {
    await this.db.destroy();
  }

  public async createIndex(options: PouchDB.Find.CreateIndexOptions) {
    await this.db.createIndex(options);
  }

  public async query<T>(options: PouchDB.Find.FindRequest<T>): Promise<PouchDB.Find.FindResponse<T>> {
    return (this.db as PouchDB.Database<T>).find(options);
  }
}
