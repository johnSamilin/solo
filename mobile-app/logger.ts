import * as FileSystem from 'expo-file-system';

const LOG_DIR = `${FileSystem.documentDirectory}logs/`;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

class Logger {
  private currentLogFile: string;
  private initialized: boolean = false;

  constructor() {
    this.currentLogFile = `${LOG_DIR}solo-${new Date().toISOString().split('T')[0]}.log`;
  }

  private async init() {
    if (this.initialized) return;

    try {
      const dirInfo = await FileSystem.getInfoAsync(LOG_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
      }

      // Rotate logs if needed
      await this.rotateLogsIfNeeded();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private async rotateLogsIfNeeded() {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.currentLogFile);
      if (fileInfo.exists && fileInfo.size >= MAX_SIZE) {
        // List all log files
        const files = await FileSystem.readDirectoryAsync(LOG_DIR);
        const logFiles = files.filter(f => f.endsWith('.log'))
          .sort((a, b) => b.localeCompare(a));

        // Remove oldest files if we exceed MAX_FILES
        while (logFiles.length >= MAX_FILES) {
          const oldestFile = logFiles.pop();
          if (oldestFile) {
            await FileSystem.deleteAsync(`${LOG_DIR}${oldestFile}`, { idempotent: true });
          }
        }

        // Create new log file
        this.currentLogFile = `${LOG_DIR}solo-${new Date().toISOString().split('T')[0]}-${Date.now()}.log`;
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  async info(message: string) {
    await this.init();
    const logEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message
    };
    await this.writeLog(logEntry);
  }

  async error(message: string, error?: any) {
    await this.init();
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      error: error?.toString(),
      stack: error?.stack
    };
    await this.writeLog(logEntry);
  }

  private async writeLog(entry: any) {
    try {
      await FileSystem.writeAsStringAsync(
        this.currentLogFile,
        JSON.stringify(entry) + '\n',
        { append: true }
      );
      await this.rotateLogsIfNeeded();
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }
}

export const logger = new Logger();