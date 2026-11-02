import { makeAutoObservable } from 'mobx';
import { TagNode } from '../types';
import { generateUniqueId } from '../utils';
import { getNativeAPI, isNative } from '../utils/nativeBridge';

const STORAGE_KEY = 'solo-tags';

export class TagsStore {
  tagTree: TagNode[] = [];

  constructor() {
    makeAutoObservable(this);
    this.loadTagsFromElectron();
  }

  loadTagsFromElectron = async () => {
    const api = getNativeAPI();
    if (!api) return;

    try {
      const result = await api.scanAllTags();
      if (result.success && result.tags) {
        this.tagTree = this.buildTagTree(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags from electron:', error);
    }
  };

  setTagTree = (tree: TagNode[]) => {
    this.tagTree = tree;
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
  };

  createTag = (path: string): string => {
    return path.trim();
  };

  private buildTagTree = (tags: string[]): TagNode[] => {
    const root: TagNode[] = [];
    const nodeMap: { [key: string]: TagNode } = {};

    tags.forEach(tagPath => {
      const parts = tagPath.split('/');
      let currentPath = '';
      let parentChildren = root;

      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!nodeMap[currentPath]) {
          const newNode: TagNode = {
            id: generateUniqueId(),
            name: part,
            path: currentPath,
            children: [],
            isChecked: false,
            isExpanded: false
          };

          nodeMap[currentPath] = newNode;
          parentChildren.push(newNode);
        }

        parentChildren = nodeMap[currentPath].children;
      });
    });

    return root;
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

  getAllTags = (nodes: TagNode[]): string[] => {
    return nodes.flatMap(node => {
      const tags = [node.name];
      if (node.children.length > 0) {
        const childTags = this.getAllTags(node.children);
        tags.push(...childTags.map(childTag => `${node.name}/${childTag}`));
      }
      return tags;
    });
  };
}