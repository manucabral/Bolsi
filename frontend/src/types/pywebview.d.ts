import type {
  CurrentSessionResult,
  LoginUserResult,
  LogoutUserResult,
  RegisterUserResult,
} from "../platform/pywebview/user.api.types";
import type {
  CategoryType,
  CreateCategoryResult,
  DeleteCategoryResult,
  ListCategoriesResult,
  UpdateCategoryResult,
} from "../platform/pywebview/categories.api.types";
import type {
  CreateCreditResult,
  DeleteCreditResult,
  ListCreditsResult,
  UpdateCreditResult,
} from "../platform/pywebview/credits.api.types";
import type {
  BackendTransactionType,
  CreateTransactionResult,
  DeleteTransactionResult,
  ListTransactionsResult,
  UpdateTransactionResult,
} from "../platform/pywebview/transactions.api.types";
import type {
  CreateNoteResult,
  DeleteNoteResult,
  ListNotesResult,
  UpdateNoteResult,
} from "../platform/pywebview/notes.api.types";
import type {
  DashboardChartExportResult,
  ExportFormat,
  OpenExportFolderResult,
  ExportSection,
  GenerateExportResult,
} from "../platform/pywebview/exports.api.types";
import type { GetAppVersionResult } from "../platform/pywebview/app.api.types";
import type {
  BackupDatabaseResult,
  GetNotificationSettingsResult,
  ListBackupsResult,
  RestoreDatabaseResult,
  RunStartupAlertsResult,
  UpdateNotificationSettingsResult,
} from "../platform/pywebview/settings.api.types";
import type {
  CreateBillResult,
  DeleteBillResult,
  ListBillsResult,
  ListMonthBillsResult,
  MarkBillPaidResult,
  MarkBillUnpaidResult,
  UpdateBillResult,
} from "../platform/pywebview/bills.api.types";
import type {
  AddSavingsEntryResult,
  CreateSavingsGoalResult,
  DeleteSavingsGoalResult,
  ListSavingsGoalsResult,
  UpdateSavingsGoalTargetResult,
} from "../platform/pywebview/savings.api.types";

export {};

declare global {
  interface Window {
    pywebview?: {
      api: {
        register_user(
          username: string,
          email: string,
          password: string,
        ): Promise<RegisterUserResult>;
        user_login(
          username: string,
          password: string,
        ): Promise<LoginUserResult>;
        user_current_session(): Promise<CurrentSessionResult>;
        user_logout(access_token?: string): Promise<LogoutUserResult>;
        categories_list(user_id: number): Promise<ListCategoriesResult>;
        categories_create(
          user_id: number,
          name: string,
          category_type: CategoryType,
          color?: string,
        ): Promise<CreateCategoryResult>;
        categories_update(
          user_id: number,
          category_id: number,
          name: string,
          category_type: CategoryType,
          color?: string,
        ): Promise<UpdateCategoryResult>;
        categories_delete(
          user_id: number,
          category_id: number,
        ): Promise<DeleteCategoryResult>;
        credits_list(user_id: number): Promise<ListCreditsResult>;
        credits_create(
          user_id: number,
          description: string,
          total_amount: number,
          installments: number,
          installment_amount: number,
          start_date: string,
          category_id?: number,
          paid_installments?: number,
        ): Promise<CreateCreditResult>;
        credits_update(
          user_id: number,
          credit_id: number,
          description: string,
          total_amount: number,
          installments: number,
          installment_amount: number,
          start_date: string,
          category_id?: number,
          paid_installments?: number,
        ): Promise<UpdateCreditResult>;
        credits_delete(
          user_id: number,
          credit_id: number,
        ): Promise<DeleteCreditResult>;
        transactions_list(user_id: number): Promise<ListTransactionsResult>;
        transactions_create(
          user_id: number,
          amount: number,
          transaction_type: BackendTransactionType,
          category_id?: number,
          description?: string,
          date?: string,
          credit_id?: number,
        ): Promise<CreateTransactionResult>;
        transactions_update(
          user_id: number,
          transaction_id: number,
          amount: number,
          transaction_type: BackendTransactionType,
          category_id?: number,
          description?: string,
          date?: string,
          credit_id?: number,
        ): Promise<UpdateTransactionResult>;
        transactions_delete(
          user_id: number,
          transaction_id: number,
        ): Promise<DeleteTransactionResult>;
        notes_list(user_id: number): Promise<ListNotesResult>;
        notes_create(
          user_id: number,
          title: string,
          content: string,
        ): Promise<CreateNoteResult>;
        notes_update(
          user_id: number,
          note_id: number,
          title: string,
          content: string,
        ): Promise<UpdateNoteResult>;
        notes_delete(
          user_id: number,
          note_id: number,
        ): Promise<DeleteNoteResult>;
        exports_generate(
          user_id: number,
          section?: ExportSection,
          export_format?: ExportFormat,
          year?: number,
          month?: number,
          from_date?: string,
        ): Promise<GenerateExportResult>;
        exports_excel(
          user_id: number,
          section?: ExportSection,
          year?: number,
          month?: number,
          from_date?: string,
        ): Promise<GenerateExportResult>;
        exports_pdf(
          user_id: number,
          section?: ExportSection,
          year?: number,
          month?: number,
          from_date?: string,
        ): Promise<GenerateExportResult>;
        exports_open_folder(user_id: number): Promise<OpenExportFolderResult>;
        exports_dashboard_chart_png(
          user_id: number,
          image_data_url: string,
        ): Promise<DashboardChartExportResult>;
        exports_dashboard_visual_pdf(
          user_id: number,
          image_data_url: string,
          period_label: string,
          generated_at: string,
          month_income: number,
          month_expense: number,
          month_balance: number,
          active_credits: number,
          pending_installments: number,
          monthly_due_amount: number,
          bills_count: number,
          overdue_bills_count: number,
          due_soon_bills_count: number,
          month_bills_amount: number,
          categories_count: number,
        ): Promise<DashboardChartExportResult>;
        app_version(): Promise<GetAppVersionResult>;
        settings_backup_database(): Promise<BackupDatabaseResult>;
        settings_list_backups(): Promise<ListBackupsResult>;
        settings_restore_database(
          backup_file_name: string,
        ): Promise<RestoreDatabaseResult>;
        settings_get_notifications(
          user_id: number,
        ): Promise<GetNotificationSettingsResult>;
        settings_update_notifications(
          user_id: number,
          bills_enabled: boolean,
          bills_days_before: number,
          credits_enabled: boolean,
          credits_days_before: number,
          summary_on_open_enabled: boolean,
        ): Promise<UpdateNotificationSettingsResult>;
        settings_run_startup_alerts(
          user_id: number,
        ): Promise<RunStartupAlertsResult>;
        bills_list(user_id: number): Promise<ListBillsResult>;
        bills_list_month(
          user_id: number,
          year?: number,
          month?: number,
        ): Promise<ListMonthBillsResult>;
        bills_create(
          user_id: number,
          name: string,
          amount: number,
          due_date: string,
          category_id?: number,
          notes?: string,
        ): Promise<CreateBillResult>;
        bills_update(
          user_id: number,
          bill_id: number,
          name: string,
          amount: number,
          due_date: string,
          category_id?: number,
          notes?: string,
        ): Promise<UpdateBillResult>;
        bills_mark_paid(
          user_id: number,
          bill_id: number,
          paid_date?: string,
          paid_amount?: number,
        ): Promise<MarkBillPaidResult>;
        bills_mark_unpaid(
          user_id: number,
          bill_id: number,
        ): Promise<MarkBillUnpaidResult>;
        bills_delete(user_id: number, bill_id: number): Promise<DeleteBillResult>;
        savings_list_goals(user_id: number): Promise<ListSavingsGoalsResult>;
        savings_create_goal(
          user_id: number,
          name: string,
          target: number,
          deadline?: string,
          color?: string,
          affects_balance?: boolean,
        ): Promise<CreateSavingsGoalResult>;
        savings_add_entry(
          user_id: number,
          goal_id: number,
          amount: number,
          note?: string,
          entry_date?: string,
        ): Promise<AddSavingsEntryResult>;
        savings_update_goal_target(
          user_id: number,
          goal_id: number,
          target: number,
        ): Promise<UpdateSavingsGoalTargetResult>;
        savings_delete_goal(
          user_id: number,
          goal_id: number,
        ): Promise<DeleteSavingsGoalResult>;
      };
    };
  }
}
