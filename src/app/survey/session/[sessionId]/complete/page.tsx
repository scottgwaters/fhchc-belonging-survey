import { CheckCircle2 } from "lucide-react";
import { SurveyChrome } from "@/components/survey/SurveyChrome";

export default function CompletePage() {
  return (
    <SurveyChrome progressFraction={1}>
      <div className="rounded-3xl border border-[#D9DFDA] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCE8E4]">
          <CheckCircle2 className="h-7 w-7 text-[#244943]" />
        </div>
        <h1 className="t-page-title">Thank you</h1>
        <p className="mt-3 text-base text-[#374151]">
          Your survey has been received. Results will be shared with leadership
          in aggregate — no individual response is linked to your identity.
        </p>
        <p className="mt-6 text-sm text-[#6B7280]">
          You can safely close this tab.
        </p>
      </div>
    </SurveyChrome>
  );
}
