import * as child_process from 'child_process';
import Logger from './logger';

interface IFlagValues {
  apiUrl: string;
  editorToken: string;
  editorType: string;
  projectName: string;
  fileName: string;
  startedAt: string;
  stoppedAt: string;
}

export default class Pulse {
  private flagValues: IFlagValues;
  private coreLocation: string;
  private logger: Logger;
  private flags = {
    apiUrl: '--api-url',
    editorToken: '--editor-token',
    editorType: '--editor-type',
    fileName: '--file-name',
    locDeleted: '--loc-deleted',
    locWritten: '--loc-written',
    projectName: '--project-name',
    startedAt: '--started-at',
    stoppedAt: '--stopped-at',
  };

  public constructor({ flags, coreLocation, logger }) {
    this.flagValues = flags;
    this.coreLocation = coreLocation;
    this.logger = logger;
  }

  public run(callback: (process: child_process.ChildProcess) => void): void {
    this.logger.debug('Sending pulse: ' + this.convertFlagsToCommand().join(' '));
    const process = child_process.execFile(
      this.coreLocation,
      this.convertFlagsToCommand(),
      (error, stdout, stderr) => {
        if (error !== null) {
          if (stderr && stderr.toString() !== '') {
            this.logger.error(stderr.toString());
          }
          if (stdout && stdout.toString() !== '') {
            this.logger.error(stdout.toString());
          }
          this.logger.error(error.toString());
        }
      }
    );
    callback(process);
  }

  private convertFlagsToCommand(): string[] {
    return [
      'send',
      this.flags.apiUrl,
      this.flagValues.apiUrl,
      this.flags.editorToken,
      this.flagValues.editorToken,
      this.flags.editorType,
      this.flagValues.editorType,
      this.flags.projectName,
      this.flagValues.projectName,
      this.flags.fileName,
      this.flagValues.fileName,
      this.flags.startedAt,
      this.flagValues.startedAt,
      this.flags.stoppedAt,
      this.flagValues.stoppedAt,
    ];
  }
}
