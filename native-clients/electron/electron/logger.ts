import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { app } from 'electron';

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024;

class Logger {
  private logFile: string = LOG_FILE;
  private initialized = false;

  async init() {
    try {
      if (!existsSync(LOG_DIR)) {
        await fs.mkdir(LOG_DIR, { recursive: true });
      }
      this.initialized = true;
      await this.checkLogSize();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private async checkLogSize() {
    try {
      if (existsSync(this.logFile)) {
        const stats = await fs.stat(this.logFile);
        if (stats.size > MAX_LOG_SIZE) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(LOG_DIR, `app-${timestamp}.log`);
          await fs.rename(this.logFile, backupFile);
        }
      }
    } catch (error) {
      console.error('Failed to check log size:', error);
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private async write(level: string, ...args: any[]) {
    if (!this.initialized) {
      return;
    }

    try {
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.stack || arg.message;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }).join(' ');

      const formatted = this.formatMessage(level, message);
      await fs.appendFile(this.logFile, formatted + '\n', 'utf-8');

      await this.checkLogSize();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(...args: any[]) {
    this.write('LOG', ...args).catch(console.error);
  }

  error(...args: any[]) {
    this.write('ERROR', ...args).catch(console.error);
  }

  warn(...args: any[]) {
    this.write('WARN', ...args).catch(console.error);
  }

  info(...args: any[]) {
    this.write('INFO', ...args).catch(console.error);
  }

  debug(...args: any[]) {
    this.write('DEBUG', ...args).catch(console.error);
  }

  getLogFile(): string {
    return this.logFile;
  }
}

export const logger = new Logger();
