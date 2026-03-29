import { getBolsiApi } from "./pywebview";
import type {
  CreateCreditResult,
  DeleteCreditResult,
  ListCreditsResult,
  UpdateCreditResult,
} from "./credits.api.types";

export async function listCredits(userId: number): Promise<ListCreditsResult> {
  const api = await getBolsiApi();
  return api.credits_list(userId);
}

export async function createCredit(
  userId: number,
  description: string,
  totalAmount: number,
  installments: number,
  installmentAmount: number,
  startDate: string,
  categoryId?: number,
  paidInstallments?: number,
): Promise<CreateCreditResult> {
  const api = await getBolsiApi();
  return api.credits_create(
    userId,
    description,
    totalAmount,
    installments,
    installmentAmount,
    startDate,
    categoryId,
    paidInstallments,
  );
}

export async function updateCredit(
  userId: number,
  creditId: number,
  description: string,
  totalAmount: number,
  installments: number,
  installmentAmount: number,
  startDate: string,
  categoryId?: number,
  paidInstallments?: number,
): Promise<UpdateCreditResult> {
  const api = await getBolsiApi();
  return api.credits_update(
    userId,
    creditId,
    description,
    totalAmount,
    installments,
    installmentAmount,
    startDate,
    categoryId,
    paidInstallments,
  );
}

export async function deleteCredit(
  userId: number,
  creditId: number,
): Promise<DeleteCreditResult> {
  const api = await getBolsiApi();
  return api.credits_delete(userId, creditId);
}
