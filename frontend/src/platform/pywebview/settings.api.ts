import { getBolsiApi } from "./pywebview";
import type {
  BackupDatabaseResult,
  ListBackupsResult,
  RestoreDatabaseResult,
} from "./settings.api.types";

export async function backupDatabase(): Promise<BackupDatabaseResult> {
  const api = await getBolsiApi();
  return api.settings_backup_database();
}

export async function listDatabaseBackups(): Promise<ListBackupsResult> {
  const api = await getBolsiApi();
  return api.settings_list_backups();
}

export async function restoreDatabase(
  backupFileName: string,
): Promise<RestoreDatabaseResult> {
  const api = await getBolsiApi();
  return api.settings_restore_database(backupFileName);
}
