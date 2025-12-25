import { FC, useState, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores/StoreProvider";
import { Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Note } from "../../../types";
import { extractParagraphTags } from "../../../utils";

interface TagUsage {
  path: string;
  count: number;
  children: TagUsage[];
}

export const Tags: FC = observer(() => {
  const { notesStore, tagsStore, settingsStore } = useStore();
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
      settingsStore.setToast("Tag renamed successfully", "success");
      setEditingTag(null);
      setNewTagName("");
    } catch (error) {
      settingsStore.setToast(
        (error as Error).message || "Failed to rename tag",
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
      settingsStore.setToast("Tag deleted successfully", "success");
    } catch (error) {
      settingsStore.setToast(
        (error as Error).message || "Failed to delete tag",
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
      <div key={tag.path} style={{ marginLeft: `${level * 1.5}rem` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0.5rem 0",
            borderBottom: "1px dotted #e0e0e0",
            gap: "0.5rem",
          }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(tag.path)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                display: "flex",
                alignItems: "center",
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}

          {!hasChildren && <span style={{ width: "1rem" }} />}

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
              style={{
                flex: 1,
                padding: "0.25rem 0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontFamily: "var(--editor-font-family)",
                fontSize: "0.9rem",
              }}
            />
          ) : (
            <span
              style={{
                flex: 1,
                fontFamily: "var(--editor-font-family)",
                fontSize: "0.9rem",
                fontWeight: level === 0 ? 500 : 400,
              }}
            >
              {displayName}
            </span>
          )}

          <span
            style={{
              fontSize: "0.8rem",
              color: "#666",
              fontStyle: "italic",
              minWidth: "2rem",
              textAlign: "right",
            }}
          >
            {tag.count > 0 ? tag.count : ""}
          </span>

          {!isEditing && (
            <>
              <button
                onClick={() => {
                  setEditingTag(tag.path);
                  setNewTagName(tag.path);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  color: "#666",
                }}
                title="Rename tag"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleDeleteTag(tag.path)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  color: "#dc2626",
                }}
                title="Delete tag"
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
      <h3 style={{
        fontFamily: "var(--editor-font-family)",
        fontSize: "1.1rem",
        marginBottom: "1rem",
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 600
      }}>
        Index
      </h3>

      {tagUsage.length === 0 ? (
        <p style={{
          textAlign: "center",
          color: "#666",
          fontFamily: "var(--editor-font-family)",
          fontStyle: "italic"
        }}>
          No tags found
        </p>
      ) : (
        <div style={{
          maxHeight: "60vh",
          overflowY: "auto",
          padding: "0 1rem",
        }}>
          {tagUsage.map((tag) => renderTagItem(tag))}
        </div>
      )}
    </div>
  );
});
