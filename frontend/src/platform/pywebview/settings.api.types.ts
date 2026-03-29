import type { ApiResponse } from "./user.api.types";

export interface BackupItem {
  file_name: string;
  file_path: string;
  size_bytes: number;
  updated_at: string;
}

export type BackupDatabaseResult = ApiResponse<{
  backup?: BackupItem;
  [key: string]: unknown;
}> & {
  backup?: BackupItem;
};

export type ListBackupsResult = ApiResponse<{
  backups?: BackupItem[];
  [key: string]: unknown;
}> & {
  backups?: BackupItem[];
};

export type RestoreDatabaseResult = ApiResponse<{
  restored_backup?: string;
  [key: string]: unknown;
}> & {
  restored_backup?: string;
};
