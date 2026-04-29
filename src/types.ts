export interface Change {
  attribute: string;
  oldValue: string;
  newValue: string;
  changeType: "added" | "removed" | "updated";
  context?: string;
}

export type ChangeSet = Change[];

export interface Segment {
  id: string;
  selector: string;
  text: string;
  outerHTML: string;
}

export interface SegmentAnalysis {
  segmentId: string;
  affected: boolean;
  relevantChanges: Change[];
  reason: string;
}

export interface Rewrite {
  segmentId: string;
  proposedCopy: string;
  rationale: string;
}

export interface PageResult {
  url: string;
  html: string;
  segments: Segment[];
  analyses: SegmentAnalysis[];
  rewrites: Rewrite[];
}
