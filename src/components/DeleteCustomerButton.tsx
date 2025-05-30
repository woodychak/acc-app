"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteCustomerAction } from "@/app/actions";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this customer?")) {
      startTransition(async () => {
        try {
          await deleteCustomerAction(customerId);
          // Optionally reload the page after delete
          window.location.reload();
        } catch (error) {
          console.error("Delete failed", error);
        }
      });
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4 mr-1" />
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
