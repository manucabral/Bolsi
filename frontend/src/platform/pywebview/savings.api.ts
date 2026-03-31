import { getBolsiApi } from "./pywebview";
import type {
  AddSavingsEntryResult,
  CreateSavingsGoalResult,
  DeleteSavingsGoalResult,
  ListSavingsGoalsResult,
  UpdateSavingsGoalTargetResult,
} from "./savings.api.types";

export async function listSavingsGoals(
  userId: number,
): Promise<ListSavingsGoalsResult> {
  const api = await getBolsiApi();
  return api.savings_list_goals(userId);
}

export async function createSavingsGoal(
  userId: number,
  name: string,
  target: number,
  deadline?: string,
  color?: string,
  affectsBalance: boolean = true,
): Promise<CreateSavingsGoalResult> {
  const api = await getBolsiApi();
  return api.savings_create_goal(
    userId,
    name,
    target,
    deadline,
    color,
    affectsBalance,
  );
}

export async function addSavingsEntry(
  userId: number,
  goalId: number,
  amount: number,
  note: string = "",
  entryDate?: string,
): Promise<AddSavingsEntryResult> {
  const api = await getBolsiApi();
  return api.savings_add_entry(userId, goalId, amount, note, entryDate);
}

export async function updateSavingsGoalTarget(
  userId: number,
  goalId: number,
  target: number,
): Promise<UpdateSavingsGoalTargetResult> {
  const api = await getBolsiApi();
  return api.savings_update_goal_target(userId, goalId, target);
}

export async function deleteSavingsGoal(
  userId: number,
  goalId: number,
): Promise<DeleteSavingsGoalResult> {
  const api = await getBolsiApi();
  return api.savings_delete_goal(userId, goalId);
}
