import {TextSegment} from './mention-utils';

export interface MarkedSegment extends TextSegment {
  /** A part of the plain text that matches the search. */
  found?: boolean;
}

/** Plain parts of the text split around the matches of the query (case-insensitive); mentions stay whole. */
export function markMatches(segments: TextSegment[], query: string): MarkedSegment[] {
  const needle = query.trim().toLocaleLowerCase('uk');
  if (needle.length < 2) {
    return segments;
  }

  const marked: MarkedSegment[] = [];
  for (const segment of segments) {
    if (segment.mention) {
      marked.push(segment);
      continue;
    }
    const lower = segment.text.toLocaleLowerCase('uk');
    let from = 0;
    let at = lower.indexOf(needle);
    // Lower-casing keeps the length for the alphabets used here, so the indexes fit the original.
    while (at >= 0 && lower.length === segment.text.length) {
      if (at > from) {
        marked.push({text: segment.text.slice(from, at)});
      }
      marked.push({text: segment.text.slice(at, at + needle.length), found: true});
      from = at + needle.length;
      at = lower.indexOf(needle, from);
    }
    if (from < segment.text.length) {
      marked.push({text: segment.text.slice(from)});
    }
  }
  return marked;
}
