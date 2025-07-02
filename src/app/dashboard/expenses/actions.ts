"use server";

import { createServerSupabaseClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";

export async function deleteExpenseAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const id = formData.get("id") as string;

  if (!id) {
    return { success: false, message: "Expense ID is required" };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "User not authenticated" };
    }

    // Delete the expense
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Ensure user can only delete their own expenses

    if (error) {
      console.error("Error deleting expense:", error);
      return { success: false, message: "Failed to delete expense" };
    }

    return { success: true, message: "Expense deleted successfully" };
  } catch (error) {
    console.error("Error in deleteExpenseAction:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function createExpenseAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "User not authenticated" };
    }

    const expenseData = {
      user_id: user.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      currency_code: formData.get("currency_code") as string,
      category: formData.get("category") as string,
      expense_date: formData.get("expense_date") as string,
      payment_method: formData.get("payment_method") as string,
      vendor: formData.get("vendor") as string,
      is_reimbursable: formData.get("is_reimbursable") === "true",
      notes: formData.get("notes") as string,
    };

    const { error } = await supabase.from("expenses").insert([expenseData]);

    if (error) {
      console.error("Error creating expense:", error);
      return { success: false, message: "Failed to create expense" };
    }

    return { success: true, message: "Expense created successfully" };
  } catch (error) {
    console.error("Error in createExpenseAction:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateExpenseAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const id = formData.get("id") as string;

  if (!id) {
    return { success: false, message: "Expense ID is required" };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: "User not authenticated" };
    }

    const expenseData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      currency_code: formData.get("currency_code") as string,
      category: formData.get("category") as string,
      expense_date: formData.get("expense_date") as string,
      payment_method: formData.get("payment_method") as string,
      vendor: formData.get("vendor") as string,
      is_reimbursable: formData.get("is_reimbursable") === "true",
      notes: formData.get("notes") as string,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("expenses")
      .update(expenseData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating expense:", error);
      return { success: false, message: "Failed to update expense" };
    }

    return { success: true, message: "Expense updated successfully" };
  } catch (error) {
    console.error("Error in updateExpenseAction:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
