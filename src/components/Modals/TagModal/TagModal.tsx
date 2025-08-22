import { X, Tag as TagIcon } from "lucide-react";
import { FC, useState, useEffect } from "react";
import { Tag, TagNode } from "../../../types";
import { TagTreeItem } from "../../Sidebar/TagTreeItem";
import { generateUniqueId, buildTagTree } from "../../../utils";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";

import '../Modals.css';
import './TagModal.css';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  appliedTags: Tag[];
  onApply: (selectedTags: Tag[]) => void;
  title?: string;
}

export const TagModal: FC<TagModalProps> = observer(({
  isOpen,
  onClose,
  appliedTags,
  onApply,
  title = "Manage Tags"
}) => {
  const { notesStore } = useStore();
  const [newTagPath, setNewTagPath] = useState('');
  const [tagTree, setTagTree] = useState<TagNode[]>([]);

  // Build tag tree from all notes when modal opens
  useEffect(() => {
    if (isOpen) {
      const allTags = Array.from(new Set(
        notesStore.notes.flatMap(note => note.tags.map(tag => tag.path))
      )).map(path => ({ id: generateUniqueId(), path }));

      const tree = buildTagTree(allTags);

      // Mark applied tags as selected
      const markSelectedTags = (nodes: TagNode[]) => {
        nodes.forEach(node => {
          node.isChecked = appliedTags.some(tag => tag.path.includes(node.name));
          if (node.children.length > 0) {
            markSelectedTags(node.children);
          }
        });
      };

      markSelectedTags(tree);
      setTagTree(tree);
    }
  }, [isOpen, notesStore.notes, appliedTags]);

  const toggleTagNode = (nodeId: string) => {
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

    setTagTree(updateNodes(tagTree));
  };

  const toggleTagCheck = (nodeId: string) => {
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

    setTagTree(updateNodes(tagTree));
  };

  const handleNewTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagPath.trim()) return;

    // Add new tag to the tree
    const newTag = { id: generateUniqueId(), path: newTagPath.trim() };
    const allTags = [
      ...Array.from(new Set(notesStore.notes.flatMap(note => note.tags.map(tag => tag.path)))),
      newTag.path
    ].map(path => ({ id: generateUniqueId(), path }));

    const tree = buildTagTree(allTags);
    
    // Mark previously selected tags and the new tag
    const markSelectedTags = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        const currentPath = getNodePath(node, tree);
        node.isChecked = appliedTags.some(tag => tag.path === currentPath) || currentPath === newTag.path;
        if (node.children.length > 0) {
          markSelectedTags(node.children);
        }
      });
    };

    markSelectedTags(tree);
    setTagTree(tree);
    setNewTagPath('');
  };

  const getNodePath = (targetNode: TagNode, nodes: TagNode[], parentPath = ''): string => {
    for (const node of nodes) {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.id === targetNode.id) {
        return currentPath;
      }
      if (node.children.length > 0) {
        const childPath = getNodePath(targetNode, node.children, currentPath);
        if (childPath) return childPath;
      }
    }
    return '';
  };

  const getSelectedTags = (nodes: TagNode[], parentPath = ''): Tag[] => {
    return nodes.flatMap(node => {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      const tags = [];

      if (node.isChecked) {
        tags.push({
          id: generateUniqueId(),
          path: currentPath
        });
      }

      if (node.children.length > 0) {
        tags.push(...getSelectedTags(node.children, currentPath));
      }

      return tags;
    });
  };

  const handleApply = () => {
    const selectedTags = getSelectedTags(tagTree);
    onApply(selectedTags);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-content">
          <div className="tag-tree">
            {tagTree.map(node => (
              <TagTreeItem
                key={node.id}
                node={node}
                onToggle={toggleTagNode}
                onCheck={toggleTagCheck}
              />
            ))}
          </div>
          <form onSubmit={handleNewTagSubmit} className="tag-input-container">
            <input
              type="text"
              value={newTagPath}
              onChange={(e) => setNewTagPath(e.target.value)}
              className="tag-input"
              placeholder="Add new tag (e.g., work/projects/active)"
            />
            <button type="submit" className="tag-apply-button">
              <TagIcon className="h-4 w-4" />
              Add Tag
            </button>
          </form>
          <div className="tag-modal-actions">
            <button
              onClick={handleApply}
              className="tag-apply-button"
            >
              Apply Selected Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});