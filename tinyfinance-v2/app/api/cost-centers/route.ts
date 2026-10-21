import { POST as create, PATCH as update } from "../modules/[module]/route";
import { NextRequest } from "next/server";
const params = { params: Promise.resolve({ module: "cost-centers" }) };
export const POST = (req: NextRequest) => create(req, params);
export const PATCH = (req: NextRequest) => update(req, params);
