import { NextResponse } from "next/server";
import { createCaptchaChallenge } from "@/lib/captcha";

export const dynamic = "force-dynamic";

export async function GET() {
  const captcha = createCaptchaChallenge();

  return NextResponse.json(
    {
      success: true,
      question: captcha.question,
      token: captcha.token,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}