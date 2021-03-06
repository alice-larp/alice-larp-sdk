/**
 * Универсальные события для хакерства и т.д.
 */

import { ModelApiInterface } from 'alice-model-engine-api';
import Chance = require('chance');
import type = require('type-detect');
import helpers = require('../helpers/model-helper');
const chance = new Chance();

/**
 * Обработчик события "put-condition"
 * Добавляет текстовое состояние в модель
 *
 * {
 *   text: string,
 *   details: string,
 *   class: string,     //physiology | mind
 *   duration: xxxx
 * }
 * параметр duration задается в секундах, и он опционален.
 * Если не задано, то состояния добавляются на 2 часа
 */
function putConditionEvent( api: ModelApiInterface, data, _ ) {
    if (data.text) {
        const cond = api.addCondition(
                        {
                            mID: '',
                            id : `putCondition-${chance.natural({min: 0, max: 999999})}`,
                            text: data.text,
                            details: data.details ? data.details : data.text,
                            class: data.class ? data.class : 'physiology',
                        });

        if (cond) {
            api.info(`putConditionEvent: add condition "${cond.text.substring(0, 20)}..."` );

            const durationMs = data.duration ? Number(data.duration) * 1000 : 7200000;

            helpers.addDelayedEvent(api, durationMs, 'remove-condition', { mID: cond.mID }, `remCond-${cond.mID}` );
        }
    }
}

/**
 * Обработчик события "remove-condition"
 * { mID: string }
 *
 * Удаляет состояние персонажа
 */

function removeConditionEvent( api: ModelApiInterface, data, _ ) {
    if (data.mID) {
        const i = api.model.conditions.findIndex((c) => c.mID == data.mID );

        if (i != -1) {
            const text = api.model.conditions[i].text;
            api.model.conditions.splice(i, 1);

            api.info(`removeConditionEvent: removed condition "${text.substring(0, 20)}..."` );
        }
    }
}

/**
 * Обработчик события "send-message"
 * Отправляет текстовое сообщение в модель (в список messages)
 *
 * {
 *   title: string,
 *   text: string,
 * }
 */
function sendMessageEvent( api: ModelApiInterface, data, _ ) {
    if (data.title && api.model.messages) {
        const message = {
                        mID : helpers.uuidv4(),
                        title: data.title,
                        text: data.text ? data.text : data.title,
                    };

        api.model.messages.push(message);
        api.info(`sendMessageEvent: send message "${message.text.substring(0, 20)}..."` );
    }
}

/**
 * Обработчик события "add-change-record"
 * Событие позволяет добавить состояние в список состояний
 *
 * {
 *   text: string,
 *   timestamp: number
 * }
 */
function addChangeRecord( api: ModelApiInterface, data, _ ) {
    if (data.text && data.timestamp) {
        helpers.addChangeRecord(api, data.text, data.timestamp);
    }
}

/**
 * Обработчик события "change-model-variable"
 * Универсальное событие для изменения любой простой (т.е. не внутри каких-то вложенных структур)
 * переменной в модели. Переменные, тип которых Object/Array менять запрещается.
 * Переменные: login,_id, timestamp, profileType менять запрещается
 *
 * Изменение проходит "тихо" для игрока - ни в каких списках изменений оно не отображается
 * (поэтому так лучше не менять что-то игровое и важное о чем надо знать)
 *
 * {
 *   name: string,
 *   value: string,
 * }
 */
function changeModelVariableEvent( api: ModelApiInterface, data, _ ) {
    if (data.name && data.value) {
        const restricted = ['_id', 'id', 'hp', 'maxHp', 'login', 'profileType', 'timestamp',
                          'mind', 'genome', 'systems', 'conditions', 'modifiers', 'changes', 'messages', 'timers' ];
        if (restricted.find((e) => e == data.name)) {
            return;
        }

        if (api.model[data.name]) {
            const t = type(api.model[data.name]);

            if (t == 'number' || t == 'string' || t == 'null' || t == 'undefined') {
                const oldValue = api.model[data.name];

                api.model[data.name] = data.value;

                api.info(`changeModelVariable:  ${data.name}:  ${oldValue} ==> ${api.model[data.name]}` );
            }
        }
    }
}

module.exports = () => {
    return {
        putConditionEvent,
        removeConditionEvent,
        sendMessageEvent,
        changeModelVariableEvent,
        addChangeRecord,
    };
};
