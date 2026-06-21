import { BrowserWindow, session } from 'electron';

// Dev needs to allow Vite's HMR (dev-server origin + websocket + inline styles);
// production locks everything to 'self'.
const DEV_CSP = [
  "default-src 'self' 'unsafe-inline' data: blob:",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
  "img-src 'self' data:",
].join('; ');

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join('; ');

/** Apply a Content-Security-Policy to all responses (must be called after app ready). */
export function installCsp(isPackaged: boolean): void {
  const csp = isPackaged ? PROD_CSP : DEV_CSP;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

/** Create the main window with a locked-down renderer (contextIsolation, no nodeIntegration). */
export function createWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  return win;
}
