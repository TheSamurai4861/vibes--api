import stringSimilarity from 'string-similarity';

/**
 * Normalizes a string for comparison by removing accents, brackets, 
 * common suffixes (like remastered, feat, live), punctuation, and extra spaces.
 * 
 * @param {string} str - The string to normalize.
 * @returns {string} The normalized string.
 */
export function normalizeString(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    // Remove accents/diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove features: feat., ft., featuring...
    .replace(/\b(feat|ft|featuring)\b.*$/i, '')
    // Remove common parenthesized/bracketed details like (Remastered...), [Live], etc.
    .replace(/\([\s\S]*?(remaster|live|mono|stereo|mix|edit|version|acoustic|explicit)[\s\S]*?\)/gi, '')
    .replace(/\[[\s\S]*?(remaster|live|mono|stereo|mix|edit|version|acoustic|explicit)[\s\S]*?\]/gi, '')
    // Remove general punctuation except alphanumeric and space
    .replace(/[^\w\s-]/g, '')
    // Clean up spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compares two strings using fuzzy matching.
 * 
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @param {number} threshold - Similarity threshold (0.0 to 1.0).
 * @returns {object} { isMatch: boolean, score: number, normalizedA: string, normalizedB: string }
 */
export function compareStrings(a, b, threshold = 0.8) {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (!normA || !normB) {
    return { isMatch: false, score: 0, normalizedA: normA, normalizedB: normB };
  }

  // Exact match after normalization
  if (normA === normB) {
    return { isMatch: true, score: 1.0, normalizedA: normA, normalizedB: normB };
  }

  // String similarity score
  let score = 0;
  try {
    // stringSimilarity might export compareTwoStrings as a property or directly depending on build
    const compareFn = stringSimilarity.compareTwoStrings || stringSimilarity;
    score = compareFn(normA, normB);
  } catch (error) {
    console.error('Error calculating string similarity:', error);
    // Simple fallback if string-similarity fails
    score = normA.includes(normB) || normB.includes(normA) ? 0.5 : 0;
  }

  return {
    isMatch: score >= threshold,
    score,
    normalizedA: normA,
    normalizedB: normB
  };
}

/**
 * Checks if two artist names are at least 80% similar (or custom threshold).
 */
export function isArtistMatch(artistA, artistB, threshold = 0.8) {
  return compareStrings(artistA, artistB, threshold).isMatch;
}

/**
 * Checks if two track titles are at least 80% similar (or custom threshold).
 */
export function isTrackMatch(trackA, trackB, threshold = 0.8) {
  return compareStrings(trackA, trackB, threshold).isMatch;
}
