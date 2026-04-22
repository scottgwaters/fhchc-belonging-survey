import { resolveToken } from "@/lib/survey";
import { TokenLanding } from "@/components/survey/TokenLanding";

export default async function SurveyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await resolveToken(token);
  return <TokenLanding state={state} token={token} />;
}
