import { makeAutoObservable } from 'mobx';
import { TagNode } from '../types';
import { generateUniqueId } from '../utils';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-tags';

export class TagsStore {
  tagTree: TagNode[] = [];

  constructor() {
    makeAutoObservable(this);
    if (!window.electronAPI) {
      this.loadFromStorage();
    }
  }

  loadTagsFromElectron = async () => {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.scanAllTags();
      if (result.success && result.tags) {
        const tags = result.tags.map((path: string) => ({
          id: generateUniqueId(),
          path
        }));
        this.tagTree = this.buildTagTree(tags);
      }
    } catch (error) {
      console.error('Error loading tags from electron:', error);
    }
  };

  private loadFromStorage = async () => {
    try {
      let storedData = { tagTree: [] };

      if (isPlugin) {
        if (window.bridge?.loadFromStorage) {
          storedData = await window.bridge.loadFromStorage(STORAGE_KEY) ?? { tagTree: [] };
          if (typeof storedData === 'string') {
            storedData = JSON.parse(storedData);
          }
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          storedData = JSON.parse(stored);
        }
      }

      if (storedData) {
        this.tagTree = storedData.tagTree;
      }
    } catch (error) {
      console.error('Error loading tags: ' + error);
    }
  };

  private saveToStorage = async () => {
    if (window.electronAPI) return;

    try {
      const data = {
        tagTree: this.tagTree
      };

      if (isPlugin) {
        if (window.bridge?.saveToStorage) {
          try {
            await window.bridge.saveToStorage(STORAGE_KEY, data);
          } catch (er) {
            await window.bridge.saveToStorage(STORAGE_KEY, JSON.stringify(data));
          }
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving tags:', error);
    }
  };

  setTagTree = (tree: TagNode[]) => {
    this.tagTree = tree;
    this.saveToStorage();
  };

  toggleTagNode = (nodeId: string) => {
    const updateNodes = (nodes: TagNode[]): TagNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    };

    this.tagTree = updateNodes(this.tagTree);
    this.saveToStorage();
  };

  toggleTagCheck = (nodeId: string) => {
    const updateNodes = (nodes: TagNode[]): TagNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isChecked: !node.isChecked };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    };

    this.tagTree = updateNodes(this.tagTree);
    this.saveToStorage();
  };

  createTag = (path: string): { id: string; path: string } => {
    return {
      id: generateUniqueId(),
      path: path.trim()
    };
  };

  // Initialize tags from notes if tag tree is empty
  initializeFromNotes = (notes: any[]) => {
    // Always ensure special timeline tags are available
    const specialTags = ['Main events', 'Главные события'];
    
    if (this.tagTree.length === 0) {
      // Collect tags from note-level tags
      const noteTagPaths = notes.flatMap(note => note.tags?.map((tag: any) => tag.path) || []);
      
      // Collect tags from paragraph tags
      const paragraphTagPaths = notes.flatMap(note => {
        if (!note.content) return [];
        
        // Parse HTML content to find paragraph tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        
        const taggedElements = tempDiv.querySelectorAll('[data-tags]');
        const paragraphTags: string[] = [];
        
        taggedElements.forEach(element => {
          const tags = element.getAttribute('data-tags');
          if (tags) {
            paragraphTags.push(...tags.split(',').map(tag => tag.trim()).filter(tag => tag));
          }
        });
        
        return paragraphTags;
      });
      
      // Combine all tags and remove duplicates
      const allTags = Array.from(new Set([...noteTagPaths, ...paragraphTagPaths, ...specialTags]))
        .map(path => ({ id: generateUniqueId(), path }));

      if (allTags.length > 0) {
        const tree = this.buildTagTree(allTags);
        this.setTagTree(tree);
      }
    } else {
      // Ensure special tags exist in existing tree
      const existingPaths = this.getAllTagPaths(this.tagTree);
      const missingTags = specialTags.filter(tag => !existingPaths.includes(tag));
      
      if (missingTags.length > 0) {
        const newTags = missingTags.map(path => ({ id: generateUniqueId(), path }));
        const allTags = [...this.getAllTags(this.tagTree), ...newTags];
        const tree = this.buildTagTree(allTags);
        this.setTagTree(tree);
      }
    }
  };

  private buildTagTree = (tags: { id: string; path: string }[]): TagNode[] => {
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
  };

  private getAllTagPaths = (nodes: TagNode[]): string[] => {
    return nodes.flatMap(node => {
      const paths = [node.name];
      if (node.children.length > 0) {
        const childPaths = this.getAllTagPaths(node.children);
        paths.push(...childPaths.map(childPath => `${node.name}/${childPath}`));
      }
      return paths;
    });
  };

  private getAllTags = (nodes: TagNode[]): { id: string; path: string }[] => {
    return nodes.flatMap(node => {
      const tags = [{ id: node.id, path: node.name }];
      if (node.children.length > 0) {
        const childTags = this.getAllTags(node.children);
        tags.push(...childTags.map(childTag => ({
          id: childTag.id,
          path: `${node.name}/${childTag.path}`
        })));
      }
      return tags;
    });
  };
}