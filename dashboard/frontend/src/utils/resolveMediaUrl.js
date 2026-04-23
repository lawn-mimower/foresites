/**
 * Extract S3 key from a full S3 URL or return the path as-is if already a key.
 * Handles URLs like: https://bucket.s3.region.amazonaws.com/images/file.jpg
 * Also strips any existing query params (e.g., expired signed URL params).
 */
function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null;
  // Strip uploads/ prefix — DB stores local paths, S3 keys don't have it
  let key = urlOrKey;
  if (key.startsWith('uploads/')) key = key.slice('uploads/'.length);
  // Already an S3 key (starts with voice/ or images/)
  if (key.startsWith('voice/') || key.startsWith('images/')) return key;
  try {
    const url = new URL(urlOrKey);
    // S3 URL: hostname contains s3 and amazonaws.com
    if (url.hostname.includes('s3') && url.hostname.includes('amazonaws.com')) {
      // pathname starts with /, strip leading slash
      return url.pathname.slice(1);
    }
  } catch {
    // Not a valid URL, return as-is
  }
  return urlOrKey;
}

/**
 * Resolve a media URL (S3 key or full S3 URL) to a signed URL via the /media-url endpoint.
 */
export async function resolveMediaUrl(urlOrKey, apiCall, apiBase) {
  if (!urlOrKey) return null;
  const s3Key = extractS3Key(urlOrKey);
  if (!s3Key) return null;
  const data = await apiCall(`${apiBase}/dashboard/media-url?path=${encodeURIComponent(s3Key)}`);
  return data?.url || null;
}
