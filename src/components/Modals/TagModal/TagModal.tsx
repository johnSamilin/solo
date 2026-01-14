import { X, Tag as TagIcon } from "lucide-react";
import { FC, useState, useEffect } from "react";
import { Tag, TagNode } from "../../../types";
import { TagTreeItem } from "../../Sidebar/TagTreeItem";
import { generateUniqueId } from "../../../utils";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { useI18n } from "../../../i18n/I18nContext";

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
  const { tagsStore } = useStore();
  const [newTagPath, setNewTagPath] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    if (isOpen) {
      const loadTags = async () => {
        await tagsStore.loadTagsFromElectron();

        const markSelectedTags = (nodes: TagNode[]): TagNode[] => {
          return nodes.map(node => {
            const isSelected = appliedTags.some(tag => tag.path.includes(node.name));
            return {
              ...node,
              isChecked: isSelected,
              children: node.children.length > 0 ? markSelectedTags(node.children) : []
            };
          });
        };

        const updatedTree = markSelectedTags(tagsStore.tagTree);
        tagsStore.setTagTree(updatedTree);
      };

      loadTags();
    }
  }, [isOpen, appliedTags, tagsStore]);

  const toggleTagNode = (nodeId: string) => {
    tagsStore.toggleTagNode(nodeId);
  };

  const toggleTagCheck = (nodeId: string) => {
    tagsStore.toggleTagCheck(nodeId);
  };

  const handleNewTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagPath.trim()) return;

    // Add new tag to the store
    const newTag = tagsStore.createTag(newTagPath.trim());
    
    // Add the new tag to the tree and mark it as selected
    const addTagToTree = (nodes: TagNode[], tagPath: string): TagNode[] => {
      const parts = tagPath.split('/');
      const currentPart = parts[0];
      const remainingPath = parts.slice(1).join('/');

      const existingNode = nodes.find(node => node.name === currentPart);
      
      if (existingNode) {
        if (remainingPath) {
          return nodes.map(node => 
            node.name === currentPart 
              ? { ...node, children: addTagToTree(node.children, remainingPath) }
              : node
          );
        } else {
          return nodes.map(node => 
            node.name === currentPart 
              ? { ...node, isChecked: true }
              : node
          );
        }
      } else {
        const newNode: TagNode = {
          id: generateUniqueId(),
          name: currentPart,
          children: remainingPath ? addTagToTree([], remainingPath) : [],
          isChecked: !remainingPath,
          isExpanded: false
        };
        return [...nodes, newNode];
      }
    };

    const updatedTree = addTagToTree(tagsStore.tagTree, newTag.path);
    tagsStore.setTagTree(updatedTree);
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
    const selectedTags = getSelectedTags(tagsStore.tagTree);
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
            {tagsStore.tagTree.map(node => (
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
              placeholder={t.tags.addNewTag}
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