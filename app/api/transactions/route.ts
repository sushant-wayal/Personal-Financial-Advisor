import { NextResponse } from "next/server";
import { ingestTransaction } from "../../../src/services/transactionIngestion";

export async function POST(req: Request) {
    const body = await req.json();
    const result = await ingestTransaction(body);

    if (!result.ok && result.reason === "invalid-amount") {
        return NextResponse.json({ error: "Transaction amount must be greater than zero" }, { status: 400 });
    }

    return NextResponse.json(result);
}
