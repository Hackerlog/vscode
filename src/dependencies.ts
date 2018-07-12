import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import Logger from './logger';
import Options, { Settings } from './options';
import version from './version';
import { apiBaseUrl } from './constants';

export enum RequestVerbs {
  GET = 'GET',
  POST = 'POST',
}

export interface IRequestOptions {
  method: RequestVerbs;
  uri: string;
  headers?: any;
  proxy?: string;
}

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
  public static isWindows(): boolean {
    return os.type() === 'Windows_NT';
  }

  private options: Options;
  private logger: Logger;
  private dirname = __dirname;
  private apiUrl = `${apiBaseUrl}/core/version`;
  private coreInstallUrl: string;
  private os: Os;
  private arch: Arch;

  constructor(options: Options, logger: Logger) {
    this.options = options;
    this.logger = logger;
    this.os = this.getOs();
    this.arch = this.getArch();

    this.createCoreUrl();
  }

  public getCoreLocation(): string {
    return Dependencies.isWindows()
      ? `${this.dirname}${path.sep}core.exe`
      : `${this.dirname}${path.sep}core`;
  }

  public isCoreInstalled(): boolean {
    const installed = fs.existsSync(this.getCoreLocation());
    this.logger.info('Core is installed: ' + installed);
    return installed;
  }

  public async installOrUpdateCore(callback: () => void): Promise<void> {
    await this.getLatestVersionUrl(async (url, isLatestVersion) => {
      if (isLatestVersion) {
        this.logger.debug('On the latest version of core. Not downloading.');
        callback();
      } else {
        this.logger.info('Downloading hackerlog core: ' + url);
        const zipFile = this.dirname + path.sep + 'core.zip';
        await this.downloadFile(url, zipFile, async () => {
          await this.extractCore(zipFile, callback);
        });
      }
    });
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
    version(this.getCoreLocation(), this.logger, currentVersion => {
      const params = `currentVersion=${currentVersion}&os=${this.os}&arch=${this.arch}`;
      this.coreInstallUrl = `${this.apiUrl}?${params}`;
    });
  }

  private async extractCore(zipFile: string, callback: () => void): Promise<void> {
    this.logger.debug(`Extracting hackerlog core into ${this.dirname}...`);
    await this.removeCore(async () => {
      await this.unzip(zipFile, this.dirname, callback);
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

  private async getLatestVersionUrl(
    callback: (download: string, latest: boolean) => void
  ): Promise<void> {
    this.logger.info('Making sure core is the latest.');
    const request = await import('request');
    await this.options.getSetting(Settings.Proxy, async proxy => {
      await this.options.getSetting(Settings.EditorKey, editorKey => {
        const options: IRequestOptions = {
          method: RequestVerbs.GET,
          uri: this.coreInstallUrl,
          headers: {
            'X-Hackerlog-EditorToken': editorKey,
          },
        };

        if (proxy && proxy.trim()) {
          options.proxy = proxy.trim();
        }

        request(options, (err, _, body) => {
          if (err) {
            this.logger.error(err);
          }
          const parsedBody = JSON.parse(body);
          const { download, latest } = parsedBody;

          callback(download, latest);
        });
      });
    });
  }

  private async downloadFile(url: string, outputFile: string, callback: () => void): Promise<void> {
    const request = await import('request');
    await this.options.getSetting(Settings.Proxy, proxy => {
      const options: IRequestOptions = {
        method: RequestVerbs.GET,
        uri: url,
      };

      if (proxy && proxy.trim()) {
        options.proxy = proxy.trim();
      }

      const r = request(options);
      const out = fs.createWriteStream(outputFile);
      r.pipe(out);
      return r.on('end', () => {
        if (callback !== null) {
          return callback();
        }
      });
    });
  }

  private async unzip(file: string, outputDir: string, callback: () => void = null): Promise<void> {
    if (fs.existsSync(file)) {
      try {
        const AdmZip = await import('adm-zip');
        const zip = new AdmZip(file);
        zip.extractAllTo(outputDir, true);
        if (!Dependencies.isWindows()) {
          fs.chmodSync(outputDir + '/core', '755');
        }
      } catch (e) {
        return this.logger.error(e);
      } finally {
        fs.unlink(file, _ => {
          if (callback) {
            return callback();
          }
        });
      }
    }
  }
}
