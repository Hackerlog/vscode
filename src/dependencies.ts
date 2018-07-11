import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import Options, { Settings } from './options';
import Logger from './logger';
import version from './version';

enum Os {
  Linux = 'linux',
  Darwin = 'darwin',
  Windows = 'windows',
  NotSupported = 'not-supported',
}

enum Arch {
  I386 = '386',
  Amd64 = 'amd64',
  NotSupported = 'not-supported',
}

export default class Dependencies {
  private options: Options;
  private logger: Logger;
  private dirname = __dirname;
  private homeDir: string;
  private apiUrl = 'http://localhost:8000/v1/core/version';
  private coreInstallUrl: string;
  private os: Os;
  private arch: Arch;

  constructor(options: Options, logger: Logger) {
    this.options = options;
    this.logger = logger;
    this.homeDir = path.resolve(os.homedir(), '.hackerlog');
    this.os = this.getOs();
    this.arch = this.getArch();

    this.createCoreUrl();
  }

  private getOs(): Os {
    switch (process.platform) {
      case 'darwin':
        return Os.Darwin;
      case 'linux':
        return Os.Linux;
      case 'win32':
        return Os.Windows;
      // Maybe handle these some day
      case 'aix':
      case 'freebsd':
      case 'openbsd':
      case 'sunos':
        return Os.NotSupported;
      default:
        return Os.NotSupported;
    }
  }

  private getArch(): Arch {
    switch (os.arch()) {
      case 'x32':
        return Arch.I386;
      case 'x64':
        return Arch.Amd64;
      // Maybe handle these some day
      case 'arm':
      case 'arm64':
      case 'ia32':
      case 'mips':
      case 'mipsel':
      case 'ppc':
      case 'ppc64':
      case 's390':
      case 's390x':
        return Arch.NotSupported;
      default:
        return Arch.NotSupported;
    }
  }

  private createCoreUrl(): void {
    version(this.getCoreLocation(), currentCoreVersion => {
      this.coreInstallUrl = `${this.apiUrl}?current_version=${currentCoreVersion}&os=${
        this.os
      }&arch=${this.arch}`;
    });
  }

  public checkAndInstall(callback: () => void): void {
    this.checkAndCreateHomeDir(() => {
      this.installOrUpdateCore(callback);
    });
  }

  public getCoreLocation(): string {
    return Dependencies.isWindows()
      ? `${this.dirname}${path.sep}core.exe`
      : `${this.dirname}${path.sep}core`;
  }

  public static isWindows(): boolean {
    return os.type() === 'Windows_NT';
  }

  private isCoreInstalled(): boolean {
    const installed = fs.existsSync(this.getCoreLocation());
    this.logger.info('Core is installed: ' + installed);
    return installed;
  }

  private installOrUpdateCore(callback: () => void): void {
    this.logger.info('Downloading hackerlog core...');
    this.getLatestVersionUrl(url => {
      this.logger.info('Downloading hackerlog core...');
      const zipFile = this.dirname + path.sep + 'core.zip';
      this.downloadFile(url, zipFile, () => {
        this.extractCore(zipFile, callback);
      });
    });
  }

  private extractCore(zipFile: string, callback: () => void): void {
    this.logger.debug(`Extracting hackerlog-core into ${this.dirname}...`);
    this.removeCore(() => {
      this.unzip(zipFile, this.dirname, callback);
      this.logger.debug('Finished extracting hackerlog core.');
    });
  }

  private async removeCore(callback: () => void): Promise<void> {
    if (fs.existsSync(this.dirname + path.sep + 'core')) {
      try {
        const rimraf = await import('rimraf');
        rimraf(this.dirname + path.sep + 'core', () => {
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

  private async getLatestVersionUrl(callback: (string) => void): Promise<void> {
    const request = await import('request');
    this.options.getSetting(Settings.Proxy, proxy => {
      let options = {
        method: 'GET',
        uri: this.coreInstallUrl,
      };

      if (proxy && proxy.trim()) {
        options['proxy'] = proxy.trim();
      }

      request(options, (err, resp) => {
        if (err) {
          this.logger.error(err);
        }
        const body = JSON.parse(resp.body);
        callback(body.download);
      });
    });
  }

  private async downloadFile(url: string, outputFile: string, callback: () => void): Promise<void> {
    const request = await import('request');
    this.options.getSetting(Settings.Proxy, proxy => {
      let options = {
        method: 'GET',
        uri: url,
      };

      if (proxy && proxy.trim()) {
        options['proxy'] = proxy.trim();
      }

      this.logger.info(JSON.stringify(options));

      let r = request(options);
      let out = fs.createWriteStream(outputFile);
      r.pipe(out);
      return r.on('end', function() {
        return out.on('finish', function() {
          if (callback !== null) {
            return callback();
          }
        });
      });
    });
  }

  private async unzip(file: string, outputDir: string, callback: () => void = null): Promise<void> {
    if (fs.existsSync(file)) {
      try {
        const AdmZip = await import('adm-zip');
        let zip = new AdmZip(file);
        zip.extractAllTo(outputDir, true);
        if (!Dependencies.isWindows()) {
          fs.chmodSync(outputDir + '/core', '755');
        }
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

  public checkAndCreateHomeDir(callback: (boolean) => void): void {
    this.logger.info('Checking and creating home dir.');
    fs.stat(this.homeDir, err => {
      if (err && err.errno === 34) {
        fs.mkdir(this.homeDir, err2 => {
          if (err2) {
            this.logger.error(err2.message);
            callback(this.isCoreInstalled());
          }
        });
      } else {
        callback(this.isCoreInstalled());
      }
    });
  }
}
