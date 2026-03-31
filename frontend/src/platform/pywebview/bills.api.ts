import { getBolsiApi } from "./pywebview";
import type {
  CreateBillResult,
  DeleteBillResult,
  ListBillsResult,
  ListMonthBillsResult,
  MarkBillPaidResult,
  MarkBillUnpaidResult,
  UpdateBillResult,
} from "./bills.api.types";

export async function listBills(userId: number): Promise<ListBillsResult> {
  const api = await getBolsiApi();
  return api.bills_list(userId);
}

export async function listMonthBills(
  userId: number,
  year?: number,
  month?: number,
): Promise<ListMonthBillsResult> {
  const api = await getBolsiApi();
  return api.bills_list_month(userId, year, month);
}

export async function createBill(
  userId: number,
  name: string,
  amount: number,
  dueDate: string,
  categoryId?: number,
  notes: string = "",
): Promise<CreateBillResult> {
  const api = await getBolsiApi();
  return api.bills_create(userId, name, amount, dueDate, categoryId, notes);
}

export async function updateBill(
  userId: number,
  billId: number,
  name: string,
  amount: number,
  dueDate: string,
  categoryId?: number,
  notes: string = "",
): Promise<UpdateBillResult> {
  const api = await getBolsiApi();
  return api.bills_update(
    userId,
    billId,
    name,
    amount,
    dueDate,
    categoryId,
    notes,
  );
}

export async function markBillPaid(
  userId: number,
  billId: number,
  paidDate?: string,
  paidAmount?: number,
): Promise<MarkBillPaidResult> {
  const api = await getBolsiApi();
  return api.bills_mark_paid(userId, billId, paidDate, paidAmount);
}

export async function markBillUnpaid(
  userId: number,
  billId: number,
): Promise<MarkBillUnpaidResult> {
  const api = await getBolsiApi();
  return api.bills_mark_unpaid(userId, billId);
}

export async function deleteBill(
  userId: number,
  billId: number,
): Promise<DeleteBillResult> {
  const api = await getBolsiApi();
  return api.bills_delete(userId, billId);
}
