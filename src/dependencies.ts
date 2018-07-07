import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';

import Options from './options';
import Logger from './logger';

export default class Dependencies {
  private cachedPythonLocation: string;
  private options: Options;
  private logger: Logger;
  private dirname = __dirname;

  constructor(options: Options, logger: Logger) {
    this.options = options;
    this.logger = logger;
  }

  public checkAndInstall(callback: () => void): void {
    this.isPythonInstalled(isInstalled => {
      if (!isInstalled) {
        this.installPython(() => {
          this.checkAndInstallCore(callback);
        });
      } else {
        this.checkAndInstallCore(callback);
      }
    });
  }

  public checkAndInstallCore(callback: () => void): void {
    if (!this.isCoreInstalled()) {
      this.installCore(callback);
    } else {
      this.isCoreLatest(isLatest => {
        if (!isLatest) {
          this.installCore(callback);
        } else {
          callback();
        }
      });
    }
  }

  public getPythonLocation(callback: (string) => void): void {
    if (this.cachedPythonLocation) return callback(this.cachedPythonLocation);

    let locations: string[] = [
      this.dirname + path.sep + 'python' + path.sep + 'pythonw',
      'python3',
      'pythonw',
      'python',
      '/usr/local/bin/python3',
      '/usr/local/bin/python',
      '/usr/bin/python3',
      '/usr/bin/python',
    ];
    for (var i = 39; i >= 26; i--) {
      if (i >= 30 && i <= 32) continue;
      locations.push('\\python' + i + '\\pythonw');
      locations.push('\\Python' + i + '\\pythonw');
    }

    this.findPython(locations, python => {
      if (python) this.cachedPythonLocation = python;
      callback(python);
    });
  }

  public getCoreLocation(): string {
    let dir =
      this.dirname + path.sep + 'hackerlog-master' + path.sep + 'hackerlog' + path.sep + 'cli.py';
    return dir;
  }

  public static isWindows(): boolean {
    return os.type() === 'Windows_NT';
  }

  private findPython(locations: string[], callback: (string) => void): void {
    const binary: string = locations.shift();
    if (!binary) {
      callback(null);
      return;
    }

    this.logger.debug('Looking for python at: ' + binary);

    const args = ['--version'];
    child_process.execFile(binary, args, (error, stdout, stderr) => {
      const output: string = stdout.toString() + stderr.toString();
      if (!error && this.isSupportedPythonVersion(output)) {
        this.cachedPythonLocation = binary;
        this.logger.debug('Valid python version: ' + output);
        callback(binary);
      } else {
        this.logger.debug('Invalid python version: ' + output);
        this.findPython(locations, callback);
      }
    });
  }

  private isCoreInstalled(): boolean {
    return fs.existsSync(this.getCoreLocation());
  }

  private isCoreLatest(callback: (boolean) => void): void {
    this.getPythonLocation(pythonBinary => {
      if (pythonBinary) {
        let args = [this.getCoreLocation(), '--version'];
        child_process.execFile(pythonBinary, args, (error, stdout, stderr) => {
          if (!(error != null)) {
            let currentVersion = stderr.toString().trim();
            this.logger.debug('Current hackerlog-core version is ' + currentVersion);

            this.logger.debug('Checking for updates to hackerlog-core...');
            this.getLatestCoreVersion(latestVersion => {
              if (currentVersion === latestVersion) {
                this.logger.debug('hackerlog-core is up to date.');
                if (callback) callback(true);
              } else if (latestVersion) {
                this.logger.debug('Found an updated hackerlog-core v' + latestVersion);
                if (callback) callback(false);
              } else {
                this.logger.debug('Unable to find latest hackerlog-core version from GitHub.');
                if (callback) callback(false);
              }
            });
          } else {
            if (callback) callback(false);
          }
        });
      } else {
        if (callback) callback(false);
      }
    });
  }

  private async getLatestCoreVersion(callback: (string) => void): Promise<void> {
    let url = 'https://raw.githubusercontent.com/hackerlog/hackerlog/master/hackerlog/__about__.py';
    const request = await import('request');
    this.options.getSetting('settings', 'proxy', function(err, proxy) {
      let options = { url: url };
      if (proxy && proxy.trim()) options['proxy'] = proxy.trim();
      request.get(options, function(error, response, body) {
        let version = null;
        if (!error && response.statusCode == 200) {
          let lines = body.split('\n');
          for (var i = 0; i < lines.length; i++) {
            let re = /^__version_info__ = \('([0-9]+)', '([0-9]+)', '([0-9]+)'\)/g;
            let match = re.exec(lines[i]);
            if (match) {
              version = match[1] + '.' + match[2] + '.' + match[3];
              if (callback) return callback(version);
            }
          }
        }
        if (callback) return callback(version);
      });
    });
  }

  private installCore(callback: () => void): void {
    this.logger.debug('Downloading hackerlog-core...');
    let url = 'https://github.com/hackerlog/hackerlog/archive/master.zip';
    let zipFile = this.dirname + path.sep + 'hackerlog-master.zip';

    this.downloadFile(url, zipFile, () => {
      this.extractCore(zipFile, callback);
    });
  }

  private extractCore(zipFile: string, callback: () => void): void {
    this.logger.debug('Extracting hackerlog-core into "' + this.dirname + '"...');
    this.removeCore(() => {
      this.unzip(zipFile, this.dirname, callback);
      this.logger.debug('Finished extracting hackerlog-core.');
    });
  }

  private async removeCore(callback: () => void): Promise<void> {
    if (fs.existsSync(this.dirname + path.sep + 'hackerlog-master')) {
      try {
        const rimraf = await import('rimraf');
        rimraf(this.dirname + path.sep + 'hackerlog-master', () => {
          if (callback != null) {
            return callback();
          }
        });
      } catch (e) {
        this.logger.warn(e);
      }
    } else {
      if (callback != null) {
        return callback();
      }
    }
  }

  private async downloadFile(url: string, outputFile: string, callback: () => void): Promise<void> {
    const request = await import('request');
    this.options.getSetting('settings', 'proxy', function(err, proxy) {
      let options = { url: url };
      if (proxy && proxy.trim()) options['proxy'] = proxy.trim();
      let r = request.get(options);
      let out = fs.createWriteStream(outputFile);
      r.pipe(out);
      return r.on('end', function() {
        return out.on('finish', function() {
          if (callback != null) {
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

  private isPythonInstalled(callback: (boolean) => void): void {
    this.getPythonLocation(pythonBinary => {
      callback(!!pythonBinary);
    });
  }

  private installPython(callback: () => void): void {
    if (Dependencies.isWindows()) {
      let ver = '3.5.1';
      let arch = 'win32';
      if (os.arch().indexOf('x64') > -1) arch = 'amd64';
      let url =
        'https://www.python.org/ftp/python/' + ver + '/python-' + ver + '-embed-' + arch + '.zip';

      this.logger.debug('Downloading python...');
      let zipFile = this.dirname + path.sep + 'python.zip';
      this.downloadFile(url, zipFile, () => {
        this.logger.debug('Extracting python...');
        this.unzip(zipFile, this.dirname + path.sep + 'python');
        this.logger.debug('Finished installing python.');

        callback();
      });
    } else {
      this.logger.error(
        'Hackerlog depends on Python. Install it from https://python.org/downloads then restart VSCode.',
      );
      // window.alert('Hackerlog depends on Python. Install it from https://python.org/downloads then restart VSCode.');
    }
  }

  private isSupportedPythonVersion(versionString: string): boolean {
    const anaconda = /continuum|anaconda/gi;
    if (!anaconda.test(versionString)) return true;

    const re = /python\w+([0-9]+)\.([0-9]+)\.([0-9]+)\w/gi;
    const ver = re.exec(versionString);
    if (!ver) return false;

    // Older Ananconda python distributions not supported
    if (parseInt(ver[1]) >= 3 && parseInt(ver[2]) >= 5) return true;

    return false;
  }
}