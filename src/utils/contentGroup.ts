export type ContentType =
  | 'Anime' | 'Ai Anime' | 'Manga' | 'Ai Manhwa'
  | 'Movie' | 'Hollywood Movie' | 'Bollywood Movie' | 'Web Series'

export const CONTENT_TYPE_OPTIONS: ContentType[] = [
  'Anime', 'Ai Anime', 'Manga', 'Ai Manhwa',
  'Hollywood Movie', 'Bollywood Movie', 'Web Series'
]

const CHAPTER_TYPES = ['Manga', 'Ai Manhwa']
const SINGLE_TYPES = ['Movie', 'Hollywood Movie', 'Bollywood Movie']

export function getContentGroup(contentType?: string): 'episode' | 'chapter' | 'single' {
  if (contentType && CHAPTER_TYPES.includes(contentType)) return 'chapter'
  if (contentType && SINGLE_TYPES.includes(contentType)) return 'single'
  return 'episode' // Anime, Ai Anime, Web Series, aur default
}

export function contentBadgeLabel(contentType?: string): 'Ch' | 'Ep' {
  return getContentGroup(contentType) === 'chapter' ? 'Ch' : 'Ep'
}

// ==================== NEW CODE ADDED BELOW ====================
export type ContentTypeFilterKey = 'All' | 'Anime' | 'Manga' | 'Movie' | 'Web Series';

export function matchesContentTypeFilter(contentType: string | undefined, filterKey: string): boolean {
  if (!filterKey || filterKey === 'All') return true;
  if (!contentType) return false;
  if (filterKey === 'Anime') return ['Anime', 'Ai Anime'].includes(contentType);
  if (filterKey === 'Manga') return ['Manga', 'Ai Manhwa'].includes(contentType);
  if (filterKey === 'Movie') return ['Movie', 'Hollywood Movie', 'Bollywood Movie'].includes(contentType);
  if (filterKey === 'Web Series') return contentType === 'Web Series';
  return contentType === filterKey;
}