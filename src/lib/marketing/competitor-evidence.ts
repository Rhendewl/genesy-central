import type { rankPosts } from "./competitor-domain";
export type RankedPost = ReturnType<typeof rankPosts>[number];
/** Descriptive evidence only: same profile, format and publication window. */
export function postEvidence(post: RankedPost, posts: RankedPost[], followers?: number | null) {
  const cohort = posts.filter(p => p.profile_id === post.profile_id && p.media_type === post.media_type);
  const comments = cohort.filter(p => p.comments_count !== null);
  const commentMean = comments.length ? comments.reduce((n,p)=>n+p.comments_count!,0)/comments.length : null;
  const commentRatio = comments.length >= 5 && commentMean !== null && commentMean > 0 && post.comments_count !== null ? post.comments_count/commentMean : null;
  const useInteractions = post.score !== null;
  const basis = useInteractions ? "interactions" : "comments";
  const comparable = useInteractions ? cohort.filter(p => p.interactions !== null) : comments;
  const value = useInteractions ? post.interactions : post.comments_count;
  const rank = value === null ? null : 1 + comparable.filter(p => (useInteractions ? p.interactions! : p.comments_count!) > value).length;
  const ratio = useInteractions ? post.score : commentRatio;
  const baseline = useInteractions ? post.baseline : commentMean;
  const sample = useInteractions ? post.sample : comments.length;
  const engagement = post.interactions !== null && followers != null && followers > 0 ? 100*post.interactions/followers : null;
  return {basis, value, rank, ratio, baseline, sample, commentRatio, engagement,
    delta: ratio === null ? null : (ratio-1)*100,
    level: ratio === null ? "unknown" : ratio >= 2 ? "high" : ratio > 1 ? "above" : ratio >= 0.8 ? "typical" : "below",
  };
}
