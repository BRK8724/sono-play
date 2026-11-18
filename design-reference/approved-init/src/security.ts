/** All mock scores are UNVERIFIED and NEVER award SONO points or loan credit. */
export type VerificationStatus='LOCAL_DEMO_ONLY'|'PENDING'|'VERIFIED'|'REJECTED';
export type RewardStatus='NOT_ELIGIBLE'|'HELD'|'APPROVED'|'REJECTED';
export interface SecureGameResult {
  sessionId:string|null;
  displayPipeScore:number;
  verifiedPipeScore:number|null;
  verificationStatus:VerificationStatus;
  rewardStatus:RewardStatus;
}
export const ENABLE_FINANCIAL_REWARDS=false as const;
export function localDemoResult(score:number):SecureGameResult {
  return {sessionId:null,displayPipeScore:score,verifiedPipeScore:null,verificationStatus:'LOCAL_DEMO_ONLY',rewardStatus:'NOT_ELIGIBLE'};
}
// No network/game session integration until SEC-02 contract + authentication approved.
