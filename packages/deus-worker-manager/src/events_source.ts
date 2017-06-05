import { EventEmitter } from 'events';
import { Nano, Follow, Change } from 'nano';
import * as Rx from 'rxjs/Rx';

export interface Event {
    _id: string,
    eventType: string,
    timestamp: number,
    characterId: string,
    data: any
}

export default class EventsSource {
    private subject: Rx.Subject<Change<Event>>;
    private feed: Follow;

    constructor(private nano: Nano, readonly dbName: string) {
        this.subject = new Rx.Subject();
    }

    follow() {
        this.feed = this.nano.db.follow(this.dbName, { since: 'now', include_docs: true });

        this.feed.filter = (doc, req) => {
            if (doc._deleted) {
                return false;
            }

            return true;
        }

        this.feed.on('change', (change: Change<Event>) => {
            this.subject.next(change);
        })

        this.feed.follow();
    }

    get observable() { return this.subject; }

    get events() {
        return this.subject.map((change) => change.doc);
    }

    get refreshModelEvents() {
        return this.events.filter((e) => {
            return Boolean(e && e.eventType === '_RefreshModel');
        });
    }
}