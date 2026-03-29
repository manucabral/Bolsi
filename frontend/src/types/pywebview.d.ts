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
  ExportSection,
  GenerateExportResult,
} from "../platform/pywebview/exports.api.types";
import type { GetAppVersionResult } from "../platform/pywebview/app.api.types";
import type {
  BackupDatabaseResult,
  ListBackupsResult,
  RestoreDatabaseResult,
} from "../platform/pywebview/settings.api.types";

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
        ): Promise<GenerateExportResult>;
        exports_csv(
          user_id: number,
          section?: ExportSection,
        ): Promise<GenerateExportResult>;
        exports_pdf(
          user_id: number,
          section?: ExportSection,
        ): Promise<GenerateExportResult>;
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
          categories_count: number,
        ): Promise<DashboardChartExportResult>;
        app_version(): Promise<GetAppVersionResult>;
        settings_backup_database(): Promise<BackupDatabaseResult>;
        settings_list_backups(): Promise<ListBackupsResult>;
        settings_restore_database(
          backup_file_name: string,
        ): Promise<RestoreDatabaseResult>;
      };
    };
  }
}
