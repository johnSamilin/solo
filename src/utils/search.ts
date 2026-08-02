import { Note, SemanticSearchResult, SemanticSearchResponse } from '../types';
import { getNativeAPI } from './nativeBridge';

export interface TagFilter {
  path: string;
  operator: 'AND' | 'OR' | 'NOT';
}

/**
 * Converts semantic search results to Note objects with highlighted paragraphs
 */
export const convertSemanticResultsToNotes = (
  semanticResults: SemanticSearchResponse,
  allNotes: Note[],
  tagFilters: TagFilter[] = [],
  relevanceThreshold: number = 0.1
): Note[] => {
  // Filter results by relevance threshold before processing
  const filteredResults = {
    ...semanticResults,
    results: semanticResults.results.filter(result =>
      result.score === undefined || result.score >= relevanceThreshold
    )
  };
  
  const groupedResults = new Map<string, { note: Note, scores: number[], paragraphs: SemanticSearchResult[] }>();
  
  filteredResults.results.forEach((result: SemanticSearchResult) => {
    // Extract note ID from noteId field or from filePath
    const noteId = result.noteId || result.filePath.replace(/\.[^/.]+$/, ''); // remove file extension
    
    // Find the corresponding note in the store
    const note = allNotes.find(n => n.id === noteId || n.filePath === result.filePath);
    
    if (note) {
      if (groupedResults.has(note.id)) {
        // If note already exists, add score and paragraph
        const existing = groupedResults.get(note.id)!;
        existing.scores.push(result.score || 0);
        existing.paragraphs.push(result);
      } else {
        // Create a new entry for the note
        groupedResults.set(note.id, {
          note: { ...note },
          scores: [result.score || 0],
          paragraphs: [result]
        });
      }
    }
  });
  
  // Convert to array and calculate average score for sorting
  return Array.from(groupedResults.values()).map(item => {
    // Create modified content with paragraphs that match search results
    let modifiedContent = item.note.content;
    
    // If there are specific paragraphs in results, modify content to show only those paragraphs
    if (item.paragraphs && item.paragraphs.length > 0) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = item.note.content;
      
      // Find elements by their index (paragraphIndex from results)
      const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
      const matchingElements: Element[] = [];
      
      item.paragraphs.forEach((paragraphResult: SemanticSearchResult) => {
        // Find element by paragraph index
        const element = elements[paragraphResult.paragraphIndex];
        if (element) {
          matchingElements.push(element);
        }
      });
      
      if (matchingElements.length > 0) {
        // Create content with only matching paragraphs
        modifiedContent = matchingElements.map(el => {
          // Add visual highlighting for paragraphs with tags
          const dataTags = el.getAttribute('data-tags');
          if (dataTags) {
            // Add a class for visual highlighting
            el.setAttribute('class', (el.getAttribute('class') || '') + ' highlighted-paragraph');
          }
          return el.outerHTML;
        }).join('<hr class="paragraph-separator" />');
      }
    } else if (tagFilters.length > 0) {
      // Fallback logic: if no specific paragraphs but tag filters exist
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = item.note.content;
      
      const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
      const matchingElements: Element[] = [];
      
      elements.forEach(element => {
        const dataTags = element.getAttribute('data-tags') || '';
        if (!dataTags) return;
        
        const paragraphTags = dataTags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        const matches = tagFilters.some(filter => {
          return paragraphTags.some(tag => tag.includes(filter.path));
        });
        
        if (matches) {
          matchingElements.push(element);
        }
      });
      
      if (matchingElements.length > 0) {
        modifiedContent = matchingElements.map(el => {
          el.setAttribute('class', (el.getAttribute('class') || '') + ' highlighted-paragraph');
          return el.outerHTML;
        }).join('<hr class="paragraph-separator" />');
      }
    }
    
    return {
      ...item.note,
      content: modifiedContent,
      // Use maximum score from all paragraphs in the note
      relevanceScore: Math.max(...item.scores)
    };
  }).sort((a, b) => {
    // Sort by relevance (descending)
    if (a.relevanceScore && b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    // If no relevance, sort by creation date
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
};

/**
 * Builds a proper boolean expression for tags
 */
export const buildTagExpression = (tagFilters: TagFilter[]): string | undefined => {
  if (tagFilters.length === 0) {
    return undefined;
  }
  
  const andFilters = tagFilters.filter(f => f.operator === 'AND').map(f => f.path);
  const orFilters = tagFilters.filter(f => f.operator === 'OR').map(f => f.path);
  const notFilters = tagFilters.filter(f => f.operator === 'NOT').map(f => f.path);
  
  const parts = [];
  
  // Add AND filters
  if (andFilters.length > 0) {
    parts.push(andFilters.join(' AND '));
  }
  
  // Add OR filters
  if (orFilters.length > 0) {
    if (orFilters.length === 1) {
      parts.push(orFilters[0]);
    } else {
      parts.push(`(${orFilters.join(' OR ')})`);
    }
  }
  
  // Add NOT filters
  if (notFilters.length > 0) {
    parts.push(...notFilters.map(tag => `NOT ${tag}`));
  }
  
  return parts.join(' AND ');
};

/**
 * Performs semantic search and converts results using all available notes
 */
export const performSemanticSearchWithNotes = async (
  searchQuery: string,
  tagFilters: TagFilter[],
  allNotes: Note[],
  relevanceThreshold: number = 0.1
): Promise<Note[]> => {
  if (!tagFilters && !searchQuery.trim()) {
    return [];
  }
  
  try {
    const api = getNativeAPI();
    if (!api?.searchSemantic) {
      console.error('Semantic search API not available');
      return [];
    }
    
    // Prepare text query and tag expression
    const queryText = searchQuery.trim() || undefined;
    const tagFiltersStr = buildTagExpression(tagFilters);
    
    const response = await api.searchSemantic(queryText, tagFiltersStr);
    
    if (!response.success || !response.result) {
      console.error('Semantic search failed:', response.error);
      return [];
    }
    
    // Convert semantic results to Notes with the provided notes array
    return convertSemanticResultsToNotes(response.result, allNotes, tagFilters, relevanceThreshold);
  } catch (error) {
    console.error('Error during semantic search:', error);
    return [];
  }
};

/**
 * Performs semantic search with just a query and tag filters
 */
export const performSemanticSearch = async (
  searchQuery: string,
  tagFilters: TagFilter[],
  relevanceThreshold: number = 0.1
): Promise<SemanticSearchResponse | null> => {
  try {
    const api = getNativeAPI();
    if (!api?.searchSemantic) {
      console.error('Semantic search API not available');
      return null;
    }
    
    // Prepare text query and tag expression
    const queryText = searchQuery.trim() || undefined;
    const tagFiltersStr = buildTagExpression(tagFilters);
    
    const response = await api.searchSemantic(queryText, tagFiltersStr);
    
    if (!response.success || !response.result) {
      console.error('Semantic search failed:', response.error);
      return null;
    }
    
    return response.result;
  } catch (error) {
    console.error('Error during semantic search:', error);
    return null;
  }
};

/**
 * Fuzzy search function
 */
export const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;
  
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  
  let queryIndex = 0;
  for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === normalizedQuery.length;
};

/**
 * Extract paragraphs that have matching tags
 */
export const getMatchingParagraphs = (content: string, tagFilters: TagFilter[]): string[] => {
  if (tagFilters.length === 0) return [];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  const matchingParagraphs: string[] = [];
  
  elements.forEach(element => {
    const dataTags = element.getAttribute('data-tags') || '';
    if (!dataTags) return;
    
    const paragraphTags = dataTags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    const matches = tagFilters.some(filter => {
      return paragraphTags.some(tag => tag.includes(filter.path));
    });
    
    if (matches) {
      matchingParagraphs.push(element.outerHTML);
    }
  });
  
  return matchingParagraphs;
};

/**
 * Extract matching paragraphs from note content based on text search
 */
export const getTextMatchingParagraphs = (content: string, query: string): string[] => {
  if (!query.trim()) return [];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  const matchingParagraphs: string[] = [];
  
  elements.forEach(element => {
    const text = element.textContent || '';
    
    if (fuzzyMatch(text, query)) {
      matchingParagraphs.push(element.outerHTML);
    }
  });
  
  return matchingParagraphs;
};

/**
 * Filter notes based on search query, tag input and tag filters (standard search)
 */
export const filterNotes = (notes: Note[], searchQuery: string, tagFilters: TagFilter[], tagInputValue: string, showOnlyEmptyNotes: boolean): Note[] => {
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasTagFilters = tagFilters.length > 0;
  const hasTagInput = tagInputValue.trim().length > 0;
  const hasAnyFilter = hasSearchQuery || hasTagFilters || hasTagInput || showOnlyEmptyNotes;

  if (!hasAnyFilter) {
    return [];
  }

  let filteredNotes = [...notes];

  // Apply empty notes filter
  if (showOnlyEmptyNotes) {
    // Assuming there's a function to check if a note is empty
    // This would need to be implemented based on the actual logic
    filteredNotes = filteredNotes.filter(note => note.content.trim() === '' && note.title.trim() === '');
  }

  // Apply text search
  if (hasSearchQuery) {
    filteredNotes = filteredNotes.filter(note => {
      if (fuzzyMatch(note.title, searchQuery.trim())) {
        return true;
      }

      const matchingParagraphs = getTextMatchingParagraphs(note.content, searchQuery.trim());
      return matchingParagraphs.length > 0;
    });
  }

  // Apply tag filters
  if (hasTagFilters) {
    filteredNotes = filteredNotes.filter(note => {
      const matchingParagraphs = getMatchingParagraphs(note.content, tagFilters);
      if (matchingParagraphs.length > 0) {
        return true;
      }

      const allTags = [...note.tags, ...(note.paragraphTags || [])];

      const andFilters = tagFilters.filter(f => f.operator === 'AND');
      const orFilters = tagFilters.filter(f => f.operator === 'OR');
      const notFilters = tagFilters.filter(f => f.operator === 'NOT');

      const andMatch = andFilters.length === 0 || andFilters.every(filter =>
        allTags.some(tag => tag.includes(filter.path))
      );

      const orMatch = orFilters.length === 0 || orFilters.some(filter =>
        allTags.some(tag => tag.includes(filter.path))
      );

      const notMatch = notFilters.every(filter =>
        !allTags.some(tag => tag.includes(filter.path))
      );

      return andMatch && orMatch && notMatch;
    });
  }

  // Apply tag input filter
  if (hasTagInput) {
    const tagInputTerms = tagInputValue.trim().split(/\s+/).filter(term => term.length > 0);
    
    if (tagInputTerms.length > 0) {
      // For now we'll use AND logic between terms in the tag input field
      filteredNotes = filteredNotes.filter(note => {
        const allNoteTags = [...note.tags, ...(note.paragraphTags || [])];
        return tagInputTerms.every(term =>
          allNoteTags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
        );
      });
    }
  }

  // Sort by relevance
  return filteredNotes.slice().sort((a, b) => {
    if (searchQuery.trim()) {
      const aTitle = a.title.toLowerCase().includes(searchQuery.toLowerCase());
      const bTitle = b.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
};