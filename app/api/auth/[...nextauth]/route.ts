import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withoutAccessToken } from "@/lib/session";

export const GET = async (req: NextRequest) => withoutAccessToken(await handlers.GET(req));
export const POST = async (req: NextRequest) => withoutAccessToken(await handlers.POST(req));
