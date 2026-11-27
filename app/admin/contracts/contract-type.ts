// Plain module (not "use client") so server pages and the client editor can
// both read these values. A value imported from a "use client" file is only a
// client reference on the server, which crashes when indexed.
export type ContractType = "TIMELY" | "MILESTONE" | "FIXED";

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  TIMELY: "Timely",
  MILESTONE: "Milestone",
  FIXED: "Fixed",
};
