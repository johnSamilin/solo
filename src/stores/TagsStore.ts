import { makeAutoObservable } from 'mobx';
import { TagNode } from '../types';
import { generateUniqueId } from '../utils';
import { isPlugin } from '../config';

const STORAGE_KEY = 'solo-tags';

export class TagsStore {
  tagTree: TagNode[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

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
    if (this.tagTree.length === 0) {
      const allTags = Array.from(new Set(
        notes.flatMap(note => note.tags?.map((tag: any) => tag.path) || [])
      )).map(path => ({ id: generateUniqueId(), path }));

      if (allTags.length > 0) {
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
}