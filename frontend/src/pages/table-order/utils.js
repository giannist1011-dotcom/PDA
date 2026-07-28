import { formatGRTime } from "@/lib/format";

export { customizationSummary as summarize } from "@/lib/customizationText";

export const roundTime = (iso) => formatGRTime(iso);
