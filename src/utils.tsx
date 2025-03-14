import { Tag, TagNode } from "./types";

// Helper function to generate unique IDs
export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export function buildTagTree(tags: Tag[]): TagNode[] {
  const root: { [key: string]: TagNode } = {};

  tags.forEach(tag => {
    const parts = tag.path.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!currentLevel[currentPath]) {
        currentLevel[currentPath] = {
          id: generateUniqueId(),
          name: part,
          children: [],
          isChecked: false,
          isExpanded: false
        };
      }
      
      if (index < parts.length - 1) {
        currentLevel = currentLevel[currentPath].children.reduce((acc, child) => {
          acc[child.name] = child;
          return acc;
        }, {} as { [key: string]: TagNode });
      }
    });
  });

  return Object.values(root);
}
