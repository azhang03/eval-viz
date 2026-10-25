// The look-closer views by key. Kept apart from the host, so tests can load the views without a page.
import type { CloserKey } from "../../content/stages";
import type { CloserView } from "./types";
import { labelerView } from "./labeler";
import { hunksView } from "./hunks";
import { splitView } from "./split";
import { iouView } from "./iou";
import { keywordsView } from "./keywords";
import { grepfnView } from "./grepfn";
import { gradeView } from "./grade";
import { tokensView } from "./tokens";
import { resultsView } from "./results";
import { funnelView } from "./funnel";
import { linksView } from "./links";
import { rewindView } from "./rewind";

export const VIEWS: Record<CloserKey, () => CloserView> = {
  labeler: labelerView, hunks: hunksView, split: splitView, iou: iouView,
  keywords: keywordsView, grepfn: grepfnView, grade: gradeView, tokens: tokensView, results: resultsView,
  funnel: funnelView, links: linksView, rewind: rewindView,
};
