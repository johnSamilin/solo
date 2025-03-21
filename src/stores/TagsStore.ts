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
      let storedData = null;

      if (isPlugin && window.brigde) {
        storedData = await window.brigde.loadFromStorage(STORAGE_KEY);
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
      console.error('Error loading tags:', error);
    }
  };

  private saveToStorage = async () => {
    try {
      const data = {
        tagTree: this.tagTree
      };

      if (isPlugin && window.brigde) {
        await window.brigde.saveToStorage(STORAGE_KEY, data);
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
}