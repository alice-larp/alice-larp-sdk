import * as genericPool from 'generic-pool';
import { Catalogs } from './catalogs_storage';
import { Config, PoolConfig } from './config';
import { LoggerInterface } from './logger';
import { Worker } from './worker';

export interface WorkersPoolInterface {
  init(): this;
  setCatalogs(catalogs: Catalogs): this;
  aquire(): Promise<Worker>;
  release(worker: Worker): Promise<any>;
  withWorker<E>(handler: (worker: Worker) => Promise<E>): Promise<E>;
  drain(): Promise<void>;
}

export class WorkersPool implements WorkersPoolInterface {
  private logger: LoggerInterface;

  private config: PoolConfig;
  private pool: genericPool.Pool<Worker>;
  private catalogs: Catalogs;

  constructor(config: Config, logger: LoggerInterface) {
    this.config = config.pool;
    this.logger = logger;
  }

  public init() {
    const factory: genericPool.Factory<Worker> = {
      create: this.createWorker,
      destroy: this.destroyWorker,
    };

    this.pool = genericPool.createPool(factory, this.config.options);
    return this;
  }

  public setCatalogs(catalogs: Catalogs) {
    this.catalogs = catalogs;
    return this;
  }

  public aquire() {
    return this.pool.acquire();
  }

  public async release(worker: Worker) {
    try {
      await this.pool.release(worker);
    } catch (e) {
      // pass
    }
  }

  public async drain() {
    await this.pool.drain();
    return this.pool.clear();
  }

  public async withWorker<E>(handler: (worker: Worker) => Promise<E>) {
    const worker = await this.aquire();
    try {
      if (this.catalogs && this.catalogs.timestamp > worker.startedAt) {
        worker.configure(this.catalogs);
      }

      return await handler(worker);
    } catch (e) {
      this.logger.error('manager', `Error while configuring worker: ${e}`);
      throw e;
    } finally {
      this.release(worker);
    }
  }

  private createWorker = async () => {
    this.logger.info('manager', 'WorkersPool::createWorker');
    const worker: Worker = new Worker(this.logger, this.config.workerModule, this.config.workerArgs)
      .onExit(() => {
        this.logger.error('manager', `Worker exit. Last output:\n ${worker.lastOutput.join()}`);
        this.pool.destroy(worker);
      });

    try {
      await worker.up();
    } catch (e) {
      this.logger.error('manager', `Error while trying to start worker: ${e}`);
      this.logger.error('manager', `Last output: ${worker.lastOutput.join()}`);
      console.error(e);
      throw e;
    }

    if (this.catalogs) {
      worker.configure(this.catalogs);
    }

    return worker;
  }

  private destroyWorker = (worker: Worker) => {
    worker.down();
  }
}
