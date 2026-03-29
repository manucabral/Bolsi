import { getBolsiApi } from "./pywebview";
import type {
  BackendTransactionType,
  CreateTransactionResult,
  DeleteTransactionResult,
  ListTransactionsResult,
  UpdateTransactionResult,
} from "./transactions.api.types";

export async function listTransactions(
  userId: number,
): Promise<ListTransactionsResult> {
  const api = await getBolsiApi();
  return api.transactions_list(userId);
}

export async function createTransaction(
  userId: number,
  amount: number,
  transactionType: BackendTransactionType,
  categoryId: number | undefined,
  description: string,
  date: string,
  creditId?: number,
): Promise<CreateTransactionResult> {
  const api = await getBolsiApi();
  return api.transactions_create(
    userId,
    amount,
    transactionType,
    categoryId,
    description,
    date,
    creditId,
  );
}

export async function updateTransaction(
  userId: number,
  transactionId: number,
  amount: number,
  transactionType: BackendTransactionType,
  categoryId: number | undefined,
  description: string,
  date: string,
  creditId?: number,
): Promise<UpdateTransactionResult> {
  const api = await getBolsiApi();
  return api.transactions_update(
    userId,
    transactionId,
    amount,
    transactionType,
    categoryId,
    description,
    date,
    creditId,
  );
}

export async function deleteTransaction(
  userId: number,
  transactionId: number,
): Promise<DeleteTransactionResult> {
  const api = await getBolsiApi();
  return api.transactions_delete(userId, transactionId);
}
