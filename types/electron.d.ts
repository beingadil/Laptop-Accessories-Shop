export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version?: string }
  | { state: 'not-available'; version?: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version?: string }
  | { state: 'error'; message?: string };

export interface ElectronBridgeAPI {
  isDesktop: boolean;
  printWindow: () => Promise<{ ok: boolean; reason?: string | null }>;
  saveBackupToDisk: (
    defaultFilename: string,
    base64Data: string
  ) => Promise<{ canceled: boolean; filePath?: string }>;
  pickBackupFile: () => Promise<{
    canceled: boolean;
    filename?: string;
    base64Data?: string;
  }>;
  getDesktopInfo: () => Promise<{ version: string; databasePath: string }>;
  checkForUpdates: () => Promise<{ supported: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}

export {};
