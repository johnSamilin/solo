declare module 'electron' {
  export interface BrowserWindowConstructorOptions {
    width?: number;
    height?: number;
    webPreferences?: WebPreferences;
  }

  export interface WebPreferences {
    preload?: string;
    nodeIntegration?: boolean;
    contextIsolation?: boolean;
    webSecurity?: boolean;
  }

  export interface IpcMain {
    handle(channel: string, listener: (event: any, ...args: any[]) => Promise<any> | any): void;
  }

  export interface Protocol {
    handle(scheme: string, handler: (request: any) => Response | Promise<Response>): void;
    registerSchemesAsPrivileged(schemes: any[]): void;
  }

  export interface Net {
    fetch(url: string): Promise<Response>;
  }

  export interface App {
    whenReady(): Promise<void>;
    getPath(name: string): string;
    on(event: string, listener: Function): void;
    quit(): void;
  }

  export interface Dialog {
    showOpenDialog(window: BrowserWindow, options: any): Promise<any>;
  }

  export class BrowserWindow {
    constructor(options: BrowserWindowConstructorOptions);
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    webContents: any;
    setFullScreen(flag: boolean): void;
    isFullScreen(): boolean;
    static getAllWindows(): BrowserWindow[];
  }

  export const app: App;
  export const ipcMain: IpcMain;
  export const dialog: Dialog;
  export const protocol: Protocol;
  export const net: Net;

  export function registerSchemesAsPrivileged(schemes: any[]): void;

  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: Function): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };
}

declare global {
  namespace NodeJS {
    interface Process {
      resourcesPath: string;
    }
  }
}

export {};
