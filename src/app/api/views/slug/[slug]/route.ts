import { NextResponse, type NextRequest } from 'next/server';

const disabledResponse = () =>
  NextResponse.json({ error: 'View sharing is disabled.' }, { status: 410 });

export async function GET(_request: NextRequest) {
  return disabledResponse();
}
