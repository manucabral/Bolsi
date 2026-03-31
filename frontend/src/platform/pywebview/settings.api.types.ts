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

export interface NotificationPreferences {
  user_id: number;
  bills_enabled: boolean;
  bills_days_before: number;
  credits_enabled: boolean;
  credits_days_before: number;
  summary_on_open_enabled: boolean;
  updated_at: string;
}

export interface StartupBillAlert {
  id: number;
  name: string;
  amount: number;
  due_date: string;
  days_until_due: number;
}

export interface StartupCreditAlert {
  id: number;
  description: string;
  installment_amount: number;
  due_date: string;
  days_until_due: number;
  installment_number: number;
  total_installments: number;
}

export interface StartupSummary {
  month: number;
  year: number;
  pending_bills_count: number;
  pending_bills_amount: number;
  monthly_credit_due_amount: number;
  current_balance: number;
}

export interface StartupNotificationsResult {
  bills: StartupBillAlert[];
  credits: StartupCreditAlert[];
  sent_count: number;
  provider_available: boolean;
}

export interface StartupCheckResultData {
  preferences: NotificationPreferences;
  notifications: StartupNotificationsResult;
  summary: StartupSummary;
  should_show_summary: boolean;
}

export type GetNotificationSettingsResult = ApiResponse<{
  notifications?: NotificationPreferences;
  [key: string]: unknown;
}> & {
  notifications?: NotificationPreferences;
};

export type UpdateNotificationSettingsResult = ApiResponse<{
  notifications?: NotificationPreferences;
  [key: string]: unknown;
}> & {
  notifications?: NotificationPreferences;
};

export type RunStartupAlertsResult = ApiResponse<{
  startup?: StartupCheckResultData;
  [key: string]: unknown;
}> & {
  startup?: StartupCheckResultData;
};
