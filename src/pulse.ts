import * as child_process from "child_process";
import Logger from "./logger";

interface FlagValues {
  apiUrl: string;
  editorToken: string;
  editorType: string;
  projectName: string;
  fileName: string;
  startedAt: string;
  stoppedAt: string;
}

export default class Pulse {
  private flagValues: FlagValues;
  private coreLocation: string;
  private logger: Logger;
  private flags = {
    apiUrl: "--api-url",
    editorToken: "--editor-token",
    editorType: "--editor-type",
    projectName: "--project-name",
    fileName: "--file-name",
    locWritten: "--loc-written",
    locDeleted: "--loc-deleted",
    startedAt: "--started-at",
    stoppedAt: "--stopped-at"
  };

  public constructor({ flags, coreLocation, logger }) {
    this.flags = flags;
    this.coreLocation = coreLocation;
    this.logger = logger;
  }

  private convertFlagsToCommand(): Array<string> {
    return [
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
      this.flagValues.stoppedAt
    ];
  }

  public run(callback: (process: child_process.ChildProcess) => void): void {
    this.logger.debug(
      "Sending pulse: " + this.convertFlagsToCommand().join(" ")
    );
    let process = child_process.execFile(
      this.coreLocation,
      this.convertFlagsToCommand(),
      (error, stdout, stderr) => {
        if (error !== null) {
          if (stderr && stderr.toString() !== "") {
            this.logger.error(stderr.toString());
          }
          if (stdout && stdout.toString() !== "") {
            this.logger.error(stdout.toString());
          }
          this.logger.error(error.toString());
        }
      }
    );
    callback(process);
  }
}
