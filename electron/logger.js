import { createStream } from 'rotating-file-stream';
import path from 'path';
import { app } from 'electron';

const logDir = path.join(app.getPath('userData'), 'logs');

// Create a rotating write stream
const logStream = createStream('solo.log', {
  size: '5M', // rotate when file size exceeds 5MB
  interval: '1d', // rotate daily
  path: logDir,
  compress: 'gzip' // compress rotated files
});

export const logger = {
  info: (message) => {
    const logEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message
    };
    logStream.write(JSON.stringify(logEntry) + '\n');
  },
  
  error: (message, error) => {
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      error: error?.toString(),
      stack: error?.stack
    };
    logStream.write(JSON.stringify(logEntry) + '\n');
  }
};