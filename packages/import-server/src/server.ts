import * as express from 'express';
import * as moment from 'moment';
import * as PouchDB from 'pouchdb';
import * as pouchDBFind from 'pouchdb-find';
import { Observable } from 'rxjs/Rx';
import * as winston from 'winston';
const Elasticsearch = require('winston-elasticsearch'); // tslint:disable-line

import { AliceExporter } from './alice-exporter';
import { processCliParams } from './cli-params';
import { config } from './config';
import { ImportRunStats } from './import-run-stats';
import { JoinCharacter, JoinCharacterDetail, JoinImporter } from './join-importer';
import { ModelRefresher } from './model-refresher';
import { EconProvider } from './providers/econ-provider';
import { Provider } from './providers/interface';
import { ImportStats } from './stats';
import { TempDbWriter } from './tempdb-writer';

PouchDB.plugin(pouchDBFind);

class ModelImportData {
  public importer: JoinImporter = new JoinImporter();
  public cacheWriter: TempDbWriter = new TempDbWriter();
  public modelRefresher: ModelRefresher = new ModelRefresher();

  public afterConversionProviders: Provider[] = [new EconProvider()];

  public currentStats = new ImportRunStats();

  public lastRefreshTime = moment([1900, 0, 1]);

  public charList: JoinCharacter[] = [];
  public charDetails: JoinCharacterDetail[] = [];

  public importCouter: number = 0;
}

const params = processCliParams();

if (!params) {
  process.exit(0);
}

// start logging
configureLogger();

winston.info('Run CLI parameters: ', params);

// Statisticts
const stats = new ImportStats();

if (
  params.export
  || params.import
  || params.id
  || params.test
  || params.list
  || params.refresh
  || params.econ) {
  // tslint:disable-next-line:variable-name
  const _id = params.id ? params.id : 0;
  const since = params.since ? moment.utc(params.since, 'YYYY-MM-DDTHH:mm') : null;

  importAndCreate(_id, (params.import === true), (params.export === true), (params.list === true),
    false, (params.refresh === true), since)
    .catch(() => process.exit(1))
    .then(() => {
      winston.info('Finished!');
      process.exit(0);
    });
} else if (params.server) {
  winston.info(`Start HTTP-server on port: ${config.port} and run import loop`);

  const app = express();
  app.listen(config.port);

  app.get('/', (_req, res) => res.send(stats.toString()));

  Observable.timer(0, config.importInterval).
    flatMap(() => importAndCreate())
    .subscribe(() => winston.info('Finished one import cycle, waiting for next'),
      () => {
        process.exit(1);
      },
      () => {
        winston.info('Finished!');
        process.exit(0);
      },
  );
}

/**
 * Предвартельные операции для импорта (токен, заливка метаданных, каталоги и т.д)
 */
async function prepareForImport(data: ModelImportData): Promise<ModelImportData> {
  const loadedStats = await data.cacheWriter.getLastStats();
  data.lastRefreshTime = loadedStats.importTime;
  await data.importer.init();
  const metadata = await data.importer.getMetadata();
  winston.info(`Received metadata!`);
  await data.cacheWriter.saveMetadata(metadata);
  winston.info(`Save metadata to cache!`);
  return data;
}

/**
 * Получение списка обновленных персонажей (выполняется с уже подготовленной ModelImportData)
 */
async function loadCharacterListFomJoin(data: ModelImportData): Promise<ModelImportData> {
  data.charList = await data.importer.getCharacterList(data.lastRefreshTime.subtract(5, 'minutes'));
  return data;
}

/**
 * Получение списка персонажей в кеше (выполняется с уже подготовленной ModelImportData)
 */
async function loadCharacterListFromCache(data: ModelImportData): Promise<ModelImportData> {
  data.charList = await data.cacheWriter.getCacheCharactersList();
  return data;
}

/**
 * Сохранение данных о персонаже из Join в кеш на CouchDB
 */
async function saveCharacterToCache(char: JoinCharacterDetail, data: ModelImportData): Promise<JoinCharacterDetail> {
  await data.cacheWriter.saveCharacter(char);
  winston.info(`Character id: ${char.CharacterId} saved to cache`);
  return char;
}

async function perfromProvide(
  provider: Provider,
  char: JoinCharacterDetail,
  exportModel: boolean = true,
): Promise<void> {
  if (!exportModel) {
    return;
  }

  if (params.ignoreInGame || !char.finalInGame) {

    return new Promise<void>((resolve, reject) => {
      Observable.from([char])
        .do(() => winston.info(`About to provide ${provider.name} for character(${char._id})`))
        .delay(1000)
        .flatMap((c) => provider.provide(c))
        .map((result: any) => {
          switch (result.result) {
            case 'success': {
              winston.info(`Provide ${provider.name} for character(${char._id}) success`);
              resolve();
            }
            case 'nothing': {
              winston.info(`Provide ${provider.name} for character(${char._id}) nothing to do`);
              resolve();
            }
            case 'problems': {
              winston.warn(`Provide ${provider.name} for character(${char._id})` +
                `failed with ${result.problems.join(', ')}`);
                resolve();
            }
            default: reject('Unexpected result.result');
          }
          resolve();
        });
      });
  }
}

/**
 * Создание модели персонажа по данным из Join и экспорт в Model-базу
 */
async function exportCharacterModel(
  char: JoinCharacterDetail,
  data: ModelImportData,
  exportModel: boolean = true): Promise<JoinCharacterDetail> {
  if (!exportModel) {
    return Observable.from([char]).toPromise();
  }

  winston.info(`About to export Character(${char._id})`);

  const exporter = new AliceExporter(
    char, await data.importer.getMetadata(), true, params.ignoreInGame);

  const exportResult = await exporter.export();
  if (exportResult) {
    char.model = exporter.model;
    char.account = exporter.account;

    winston.info(
      `Exported model and account for character ${char._id}, results: ${JSON.stringify(exportResult)}`);
  } else {
    if (char.InGame) {
      winston.info(
        `Model and account for character ${char._id} not exported: model alredy IN THE GAME`);
      char.finalInGame = true;    // Отметить что эту модель дальше не надо обрабатывать
    }
  }

  return char;
}

/**
 * Посылка события Refresh-модели
 */
async function sendModelRefresh(char: JoinCharacterDetail, data: ModelImportData): Promise<JoinCharacterDetail> {
  const c = await data.modelRefresher.sentRefreshEvent(char);
  winston.info(`Refresh event sent to model for character id = ${char._id}: ` + JSON.stringify(c));
  return char;
}

/*
 * Создание e-mail адресов и учеток для всех персонажей
 *
function provisionMailAddreses(data: ModelImportData): Promise<any> {
    //winston.info(`provisionMailAddreses: ` + data.charDetails.map(c=>c._id).join(','));
    return data.mailProvision.createEmails(data.charDetails).then( c => {
        winston.info(
`Request for mail creation was sent for: ${data.charDetails.map(c=>c._id).join(',')}, result: ${JSON.stringify(c)}`);
        return c;
    });
}
*/

/**
 * Получение потока данных персонажей (выполняется с уже подготовленной ModelImportData)
 */
function loadCharactersFromJoin(data: ModelImportData): Observable<JoinCharacterDetail> {
  let bufferCounter = 0;
  winston.info('Load characters from JoinRPG');

  return Observable.from(data.charList)
    .bufferCount(config.importBurstSize)        // Порезать на группы по 20

    // Добавить задержку между обработкой записей
    .flatMap((c) => Observable.from([c]).delay(config.importBurstDelay), 1)

    // Каждую группу преобразовать в один общий Promise, ждущий все запросы в группе
    .mergeMap((cl: JoinCharacter[]) => {
      const characterIds = cl.map((d) => d.CharacterId);
      winston.info(`# Process ${bufferCounter}, size=${config.importBurstSize}: ${characterIds.join(',')} #`);
      bufferCounter++;

      const promiseArr: Array<Promise<JoinCharacterDetail>> = [];
      cl.forEach((c) => promiseArr.push(data.importer.getCharacter(c.CharacterLink)));

      return Promise.all(promiseArr);
    }, 1)
    .retry(3)

    // Полученные данные группы разбить на отдельные элементы для обработки
    .mergeMap((cl: JoinCharacterDetail[]) => Observable.from(cl))

    .do((c: JoinCharacterDetail) => winston.info(`Imported character: ${c.CharacterId}`));  // Написать в лог
}

/**
 * Получение потока данных персонажей из кэша (выполняется с уже подготовленной ModelImportData)
 */
function loadCharactersFromCache(data: ModelImportData): Observable<JoinCharacterDetail> {
  let bufferCounter = 0;
  winston.info('Load characters from CouchDB cache');

  return Observable.from(data.charList)
    .bufferCount(config.importBurstSize)        // Порезать на группы по 20
    // Полученные данные группы разбить на отдельные элементы для обработки
    .mergeMap((cl: JoinCharacter[]) => {
      const characterIds = cl.map((d) => d.CharacterId);
      winston.info(`# Process ${bufferCounter}, size=${config.importBurstSize}: ${characterIds.join(',')} #`);
      bufferCounter++;

      const promiseArr: Array<Promise<JoinCharacterDetail>> = [];
      cl.forEach((c) => promiseArr.push(data.cacheWriter.getCacheCharacter(c.CharacterId.toString())));

      return Promise.all(promiseArr);
    }, 1)
    .retry(3)
    // Полученные данные группы разбить на отдельные элементы для обработки
    .mergeMap((cl: JoinCharacterDetail[]) => Observable.from(cl))
    .do((c: JoinCharacterDetail) => winston.info(`Imported character: ${c.CharacterId}`));  // Написать в лог
}

/**
 *  Функция для импорта данных из Join, записи в кеш CouchDB, создания и экспорта моделей
 *  (т.е. вся цепочка)
 */
async function importAndCreate(id: number = 0,
                               importJoin: boolean = true,
                               exportModel: boolean = true,
                               onlyList: boolean = false,
                               updateStats: boolean = true,
                               refreshModel: boolean = true,
                               updatedSince: moment.Moment | null = null,
): Promise<void> {

  const sinceText = updatedSince ? updatedSince.format('DD-MM-YYYY HH:mm:SS') : '';

  winston.info(`Run import sequence with: id=${id}, import=${importJoin}, export=${exportModel}, ` +
    `onlyList=${onlyList}, updateStats=${updateStats}, refresh=${refreshModel}, ` +
    `updateSince=${sinceText}`);

  // Объект с рабочими данными при импорте - экспорте
  const workData = new ModelImportData();

  let importData = await prepareForImport(workData);
  if (updatedSince)
    importData.lastRefreshTime = updatedSince;
  winston.info('Using update since time: ' + importData.lastRefreshTime.format('DD-MM-YYYY HH:mm:SS'));
  if (id) {
    importData.charList.push(JoinImporter.createJoinCharacter(id));
  } else if (importJoin) {
    importData = await loadCharacterListFomJoin(importData);
  } else {
    importData = await loadCharacterListFromCache(importData);
  }

  winston.info(`Received character list: ${importData.charList.length} characters`);

  // Если это только запрос списка - закончить
  if (onlyList)
    return;

  // Загрузить данные из Join или из кеша
  const charactersDetails = importJoin ? loadCharactersFromJoin(importData) : loadCharactersFromCache(importData);
  return new Promise<void>((resolve, reject) => {
    charactersDetails
      // Добавить задержку между обработкой записей
      .flatMap((c) => Observable.from([c]).delay(config.importDelay), 1)

      // Сохранить данные в кеш (если надо)
      .flatMap((c) => importJoin ? saveCharacterToCache(c, workData) : Observable.from([c]))

      // Остановить обработку, если в модели нет флага InGame
      // (игра началась и дальше импортировать что-то левое не нужно)
      .filter((c) => {
        if (config.importOnlyInGame && !c.InGame) {
          winston.info(`Character id=${c._id} have no flag "InGame", and not imported`);
          return false;
        }
        return true;
      })

      // Экспортировать модель в БД (если надо)
      .flatMap((c) => Observable.from([c]).delay(1000), 1)
      .flatMap((c) => exportCharacterModel(c, workData, exportModel))

      // Если персонаж "В игре" остановить дальнейшую обработку
      .filter((c) => (!c.finalInGame))
      .flatMap((c) => {
        return (async () => {
          await Promise.all(
            workData.afterConversionProviders.map((provider) =>  perfromProvide(provider, c, exportModel),
          ));
          return c;
        })();
      })

      // Сохранить данные по персонажу в общий список
      .do((c) => workData.charDetails.push(c))

      // Послать модели Refresh соообщение для создания Work и View-моделей
      .flatMap((c) => refreshModel ? sendModelRefresh(c, workData) : Observable.from([c]))

      // Посчитать статистику
      .do(() => workData.importCouter++)

      // Собрать из всех обработанных данных всех персонажей общий массив и передать дальше как один элемент
      .toArray()
      // Отправить запрос на создание почтовых ящиков для всхе персонажей
      .filter(() => workData.charDetails.length > 0)

      .subscribe(() => { },
        (error) => {
          winston.error('Error in pipe: ', error);
          reject(error);
        },
        () => {
          if (updateStats) {
            workData.cacheWriter.saveLastStats(new ImportRunStats(moment.utc()));
          }
          winston.info(`Import sequence completed. Imported ${workData.importCouter} models!`);
          resolve();
        },
    );
  });
}

function configureLogger() {

  winston.remove('console');
  if (process.env.NODE_ENV !== 'production') {

    winston.add(winston.transports.Console, {
      level: 'debug',
      colorize: true,
      prettyPrint: true,
    });
  }

  winston.add(winston.transports.File, {
    filename: config.log.logFileName,
    json: false,
    level: 'debug',
  });

  winston.add(Elasticsearch,
    { level: 'debug', indexPrefix: 'importserver-logs', clientOpts: { host: config.log.elasticHost } });

  winston.add(winston.transports.File, {
    name: 'warn-files',
    filename: config.log.warnFileName,
    json: false,
    level: 'warn',
  });

  winston.handleExceptions(new winston.transports.File({
    filename: 'path/to/exceptions.log',
    handleExceptions: true,
    humanReadableUnhandledException: true,
    json: false,
    level: 'debug',
  }));
}
