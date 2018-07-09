import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import Options, { Settings } from "./options";
import Logger from "./logger";

export default class Dependencies {
  private options: Options;
  private logger: Logger;
  private dirname = __dirname;
  private homeDir: string;
  private coreInstallUrl = "http://localhost:8000/v1/core/version";

  constructor(options: Options, logger: Logger) {
    this.options = options;
    this.logger = logger;
    this.homeDir = path.resolve(os.homedir(), ".hackerlog");
  }

  public checkAndInstall(callback: () => void): void {
    this.checkAndCreateHomeDir(() => {
      this.checkAndInstallCore(callback);
    });
  }

  public checkAndInstallCore(callback: () => void): void {
    this.installOrUpdateCore(callback);
  }

  public getCoreLocation(): string {
    let dir =
      this.dirname +
      path.sep +
      "hackerlog-master" +
      path.sep +
      "hackerlog" +
      path.sep;

    if (Dependencies.isWindows()) {
      return `${dir}/core.exe`;
    }

    return `${dir}/core`;
  }

  public static isWindows(): boolean {
    return os.type() === "Windows_NT";
  }

  private isCoreInstalled(): boolean {
    return fs.existsSync(this.getCoreLocation());
  }

  private installOrUpdateCore(callback: () => void): void {
    this.logger.debug("Downloading hackerlog-core...");
    const zipFile = this.dirname + path.sep + "hackerlog-core.zip";
    this.downloadFile(this.coreInstallUrl, zipFile, () => {
      this.extractCore(zipFile, callback);
    });
  }

  private extractCore(zipFile: string, callback: () => void): void {
    this.logger.debug(`Extracting hackerlog-core into ${this.dirname}...`);
    this.removeCore(() => {
      this.unzip(zipFile, this.dirname, callback);
      this.logger.debug("Finished extracting hackerlog-core.");
    });
  }

  private async removeCore(callback: () => void): Promise<void> {
    if (fs.existsSync(this.dirname + path.sep + "hackerlog-master")) {
      try {
        const rimraf = await import("rimraf");
        rimraf(this.dirname + path.sep + "hackerlog-master", () => {
          if (callback !== null) {
            return callback();
          }
        });
      } catch (e) {
        this.logger.warn(e);
      }
    } else {
      if (callback !== null) {
        return callback();
      }
    }
  }

  private async downloadFile(
    url: string,
    outputFile: string,
    callback: () => void
  ): Promise<void> {
    const request = await import("request");
    this.options.getSetting(Settings.Proxy, proxy => {
      let options = { url: url };

      if (proxy && proxy.trim()) {
        options["proxy"] = proxy.trim();
      }

      let r = request.get(options);
      let out = fs.createWriteStream(outputFile);
      r.pipe(out);
      return r.on("end", function() {
        return out.on("finish", function() {
          if (callback !== null) {
            return callback();
          }
        });
      });
    });
  }

  private async unzip(
    file: string,
    outputDir: string,
    callback: () => void = null
  ): Promise<void> {
    if (fs.existsSync(file)) {
      try {
        const AdmZip = await import("adm-zip");
        let zip = new AdmZip(file);
        zip.extractAllTo(outputDir, true);
      } catch (e) {
        return this.logger.error(e);
      } finally {
        fs.unlink(file, unlinkError => {
          if (callback) {
            return callback();
          }
        });
      }
    }
  }

  public checkAndCreateHomeDir(callback: () => void): void {
    fs.stat(this.homeDir, err => {
      if (err && err.errno === 34) {
        fs.mkdir(this.homeDir, callback);
      } else {
        callback();
      }
    });
  }
}
