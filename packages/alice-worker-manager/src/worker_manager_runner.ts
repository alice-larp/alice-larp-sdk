import 'reflect-metadata';

import * as meow from 'meow';
import * as path from 'path';

import { ManagerToken } from './di_tokens';

import { Container } from 'typedi';
import { Config } from './config';
import { initializeDI } from './di';

const cli = meow(`
Usage
$ ${path.basename(__filename)} -c <path-to-config>
`);

if (!cli.flags.c) {
  cli.showHelp(1);
}

const CONFIG_PATH = cli.flags.c;

const config = require(CONFIG_PATH) as Config; // tslint:disable-line
initializeDI(config);

const manager = Container.get(ManagerToken);
manager.init().then(() => {});
