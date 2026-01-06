import { FC, useState, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Note } from "../../../types";
import { extractParagraphTags } from "../../../utils";
import { useI18n } from "../../../i18n/I18nContext";
import "./Tags.css";

interface TagUsage {
  path: string;
  count: number;
  children: TagUsage[];
}

export const Tags: FC = observer(() => {
  const { notesStore, tagsStore, settingsStore } = useStore();
  const { t } = useI18n();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  const tagUsage = useMemo(() => {
    const countMap = new Map<string, number>();

    notesStore.notes.forEach((note: Note) => {
      note.tags.forEach((tag) => {
        countMap.set(tag.path, (countMap.get(tag.path) || 0) + 1);
      });

      const paragraphTags = extractParagraphTags(note.content);
      paragraphTags.forEach((tag) => {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      });
    });

    const buildHierarchy = (tags: string[]): TagUsage[] => {
      const root: { [key: string]: TagUsage } = {};

      tags.forEach((tagPath) => {
        const parts = tagPath.split("/");
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!currentLevel[currentPath]) {
            currentLevel[currentPath] = {
              path: currentPath,
              count: countMap.get(currentPath) || 0,
              children: [],
            };
          }

          if (index < parts.length - 1) {
            const children = currentLevel[currentPath].children;
            const childrenMap = children.reduce((acc, child) => {
              acc[child.path] = child;
              return acc;
            }, {} as { [key: string]: TagUsage });
            currentLevel = childrenMap;
          }
        });
      });

      return Object.values(root);
    };

    return buildHierarchy(Array.from(countMap.keys()).sort());
  }, [notesStore.notes]);

  const handleRenameTag = async (oldPath: string) => {
    if (!newTagName.trim() || newTagName.trim() === oldPath) {
      setEditingTag(null);
      return;
    }

    try {
      await notesStore.renameTag(oldPath, newTagName.trim());
      await tagsStore.loadTagsFromElectron();
      settingsStore.setToast(t.tags.tagRenamed, "success");
      setEditingTag(null);
      setNewTagName("");
    } catch (error) {
      settingsStore.setToast(
        (error as Error).message || t.tags.failedToRename,
        "error"
      );
    }
  };

  const handleDeleteTag = async (tagPath: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagPath}"? This will remove it from all notes.`)) {
      return;
    }

    try {
      await notesStore.deleteTag(tagPath);
      await tagsStore.loadTagsFromElectron();
      settingsStore.setToast(t.tags.tagDeleted, "success");
    } catch (error) {
      settingsStore.setToast(
        (error as Error).message || t.tags.failedToDelete,
        "error"
      );
    }
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedTags(newExpanded);
  };

  const renderTagItem = (tag: TagUsage, level: number = 0) => {
    const isExpanded = expandedTags.has(tag.path);
    const isEditing = editingTag === tag.path;
    const hasChildren = tag.children.length > 0;
    const displayName = tag.path.split("/").pop() || tag.path;

    return (
      <div key={tag.path} className={`tag-item-wrapper ${level > 0 ? `level-${Math.min(level, 5)}` : ''}`}>
        <div className="tag-item">
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(tag.path)}
              className="tag-expand-button"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}

          {!hasChildren && <span className="tag-spacer" />}

          {isEditing ? (
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onBlur={() => handleRenameTag(tag.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameTag(tag.path);
                } else if (e.key === "Escape") {
                  setEditingTag(null);
                  setNewTagName("");
                }
              }}
              autoFocus
              className="tag-edit-input"
            />
          ) : (
            <span className={`tag-name ${level === 0 ? 'level-0' : 'level-nested'}`}>
              {displayName}
            </span>
          )}

          <span className="tag-count">
            {tag.count > 0 ? tag.count : ""}
          </span>

          {!isEditing && (
            <>
              <button
                onClick={() => {
                  setEditingTag(tag.path);
                  setNewTagName(tag.path);
                }}
                className="tag-action-button"
                title={t.tags.renameTag}
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleDeleteTag(tag.path)}
                className="tag-action-button delete"
                title={t.tags.deleteTag}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>

        {hasChildren && isExpanded && tag.children.map((child) => renderTagItem(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="settings-group">
      <h3 className="tags-title">Index</h3>

      {tagUsage.length === 0 ? (
        <p className="tags-empty">No tags found</p>
      ) : (
        <div className="tags-container">
          {tagUsage.map((tag) => renderTagItem(tag))}
        </div>
      )}
    </div>
  );
});
