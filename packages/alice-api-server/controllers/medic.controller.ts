import { CharacterlessEvent } from 'alice-model-engine-api';
import * as express from 'express';
import { Body, CurrentUser, JsonController, Param, Post, Res } from 'routing-controllers';
import { Container } from 'typedi';
import { EventsProcessor } from '../events.processor';
import { DatabasesContainerToken } from '../services/db-container';
import { canonicalId, checkAccess, currentTimestamp, returnCharacterNotFoundOrRethrow } from '../utils';

import { AliceAccount } from '../models/alice-account';

interface RunLabTestsRequest {
  patientId: string;
  tests: string[];
}

interface AddCommentRequest {
  patientId: string;
  text: string;
}

interface ScanQrRequest {
  data: any;
}

@JsonController()
export class MedicController {
  @Post('/medic/run_lab_tests/:id')
  public async runLabTests(
     @CurrentUser() user: AliceAccount,
     @Param('id') id: string,
     @Body() req: RunLabTestsRequest,
     @Res() res: express.Response,
    ) {
    try {
      id = await canonicalId(id);
      await checkAccess(user, id);
      const dbContainer = Container.get(DatabasesContainerToken);
      const model = await dbContainer.modelsDb().get(req.patientId);

      let timestamp = currentTimestamp();

      const events: CharacterlessEvent[] = req.tests.map((test: string) => {
        return {
          eventType: 'medic-run-lab-test',
          timestamp: timestamp++,
          data: {
            test,
            model,
          },
        };
      });
      const s = await new EventsProcessor().process(id, { events, scheduledUpdateTimestamp: timestamp++ });
      res.status(s.status);
      return s.body;
    } catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }

  @Post('/medic/add_comment/:id')
  public async addComment( @CurrentUser() user: AliceAccount, @Param('id') id: string, @Body() req: AddCommentRequest,
                           @Res() res: express.Response) {
    try {
      id = await canonicalId(id);
      await checkAccess(user, id);

      const dbContainer = Container.get(DatabasesContainerToken);
      const model = await dbContainer.modelsDb().get(req.patientId);

      let timestamp = currentTimestamp();
      const events: CharacterlessEvent[] = [{
        eventType: 'medic-add-comment',
        timestamp: timestamp++,
        data: {
          text: req.text,
          model,
        },
      }];

      const s = await new EventsProcessor().process(id, { events, scheduledUpdateTimestamp: timestamp++ });
      res.status(s.status);
      return s.body;
    } catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }

  @Post('/medic/scan_qr/:id')
  public async scanQr( @CurrentUser() user: AliceAccount, @Param('id') id: string, @Body() req: ScanQrRequest,
                       @Res() res: express.Response) {
    try {
      id = await canonicalId(id);
      await checkAccess(user, id);

      let timestamp = currentTimestamp();
      const events: CharacterlessEvent[] = [{
        eventType: 'scanQr',
        timestamp: timestamp++,
        data: req.data,
      }];

      const s = await new EventsProcessor().process(id, { events, scheduledUpdateTimestamp: timestamp++ });
      res.status(s.status);
      return s.body;
    } catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }
}
