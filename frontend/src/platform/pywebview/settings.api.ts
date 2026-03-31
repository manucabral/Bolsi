import { getBolsiApi } from "./pywebview";
import type {
  BackupDatabaseResult,
  GetNotificationSettingsResult,
  ListBackupsResult,
  RestoreDatabaseResult,
  RunStartupAlertsResult,
  UpdateNotificationSettingsResult,
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

export async function getNotificationSettings(
  userId: number,
): Promise<GetNotificationSettingsResult> {
  const api = await getBolsiApi();
  return api.settings_get_notifications(userId);
}

export async function updateNotificationSettings(
  userId: number,
  billsEnabled: boolean,
  billsDaysBefore: number,
  creditsEnabled: boolean,
  creditsDaysBefore: number,
  summaryOnOpenEnabled: boolean,
): Promise<UpdateNotificationSettingsResult> {
  const api = await getBolsiApi();
  return api.settings_update_notifications(
    userId,
    billsEnabled,
    billsDaysBefore,
    creditsEnabled,
    creditsDaysBefore,
    summaryOnOpenEnabled,
  );
}

export async function runStartupAlerts(
  userId: number,
): Promise<RunStartupAlertsResult> {
  const api = await getBolsiApi();
  return api.settings_run_startup_alerts(userId);
}
