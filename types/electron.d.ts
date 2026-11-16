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
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}

export {};
