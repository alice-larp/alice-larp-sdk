import * as Path from 'path';
// TODO: Figure out how to use proper absolutish paths
import { Config } from '../../../alice-model-engine/src/config';
import { requireDir } from '../../../alice-model-engine/src/utils';
import { Worker } from '../../../alice-model-engine/src/worker';

import { EngineContext, EngineResult, EngineResultOk, Event } from 'alice-model-engine-api';
import * as Winston from 'winston';

let WORKER_INSTANCE: Worker | null = null;

function getWorker() {
    if (WORKER_INSTANCE) return WORKER_INSTANCE;

    (Winston as any).level = 'warn';

    const catalogsPath = Path.resolve(__dirname, '../../../../catalogs');
    const modelsPath = Path.resolve(__dirname, '../../src');

    const config = Config.parse(requireDir(catalogsPath));
    return WORKER_INSTANCE = Worker.load(modelsPath).configure(config);
}

function process_(model: EngineContext, events: Event[]): Promise<EngineResult> {
    return getWorker().process(model, events);
}

export async function process(model: EngineContext, events: Event[]): Promise<EngineResultOk> {
    const result = await process_(model, events);
    if (result.status == 'error') throw result.error;
    return result;
}

export function findModifier(id: string, model: any): any {
    return model.modifiers.find((m: any) => m.name == id);
}

export function findChangeRecord(text: string, model: any): any {
    return model.changes.find((c: any) => c.text.startsWith(text));
}
