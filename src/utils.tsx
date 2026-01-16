// Helper function to generate unique IDs
export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export function extractParagraphTags(htmlContent: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const tags = new Set<string>();

  const paragraphs = doc.querySelectorAll('p[data-tags]');
  paragraphs.forEach(paragraph => {
    const tagsAttr = paragraph.getAttribute('data-tags');
    if (tagsAttr) {
      const paragraphTags = tagsAttr.split(',').filter(tag => tag.trim());
      paragraphTags.forEach(tag => tags.add(tag.trim()));
    }
  });

  return Array.from(tags).sort();
}
