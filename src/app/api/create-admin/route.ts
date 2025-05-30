import { NextResponse } from "next/server";
import { createDefaultAdminIfNeeded } from "../../actions";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Admin creation is disabled. Each user manages their own account.",
  });
}
