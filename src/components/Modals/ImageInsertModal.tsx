import { X, Upload, Database } from 'lucide-react';
import { FC, useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import { DigikamTag } from '../../types';

interface ImageInsertModalProps {
  onClose: () => void;
  onInsertFile: (file: File) => void;
  onInsertCarousel: (images: string[]) => void;
}

interface TagNode extends DigikamTag {
  children: TagNode[];
}

export const ImageInsertModal: FC<ImageInsertModalProps> = observer(({
  onClose,
  onInsertFile,
  onInsertCarousel
}) => {
  const { settingsStore } = useStore();
  const [activeTab, setActiveTab] = useState<'file' | 'digikam'>('file');
  const [tags, setTags] = useState<TagNode[]>([]);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDigikamDb = !!settingsStore.digikamDbPath;

  useEffect(() => {
    if (hasDigikamDb && activeTab === 'digikam') {
      loadTags();
    }
  }, [activeTab, hasDigikamDb]);

  const loadTags = async () => {
    if (!settingsStore.digikamDbPath || !window.electronAPI) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.getDigikamTags(settingsStore.digikamDbPath);
      if (result.success && result.tags) {
        const tagTree = buildTagTree(result.tags);
        setTags(tagTree);
      } else {
        settingsStore.setToast(result.error || 'Failed to load tags', 'error');
      }
    } catch (error) {
      settingsStore.setToast('Failed to load tags from digiKam', 'error');
    } finally {
      setLoading(false);
    }
  };

  const buildTagTree = (flatTags: DigikamTag[]): TagNode[] => {
    const tagMap = new Map<number, TagNode>();
    const roots: TagNode[] = [];

    flatTags.forEach(tag => {
      tagMap.set(tag.id, { ...tag, children: [] });
    });

    flatTags.forEach(tag => {
      const node = tagMap.get(tag.id)!;
      if (tag.parentId === null || tag.parentId === 0) {
        roots.push(node);
      } else {
        const parent = tagMap.get(tag.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    return roots;
  };

  const toggleTagExpansion = (tagId: number) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId);
    } else {
      newExpanded.add(tagId);
    }
    setExpandedTags(newExpanded);
  };

  const handleTagSelect = async (tagId: number) => {
    if (!settingsStore.digikamDbPath || !window.electronAPI) return;

    setSelectedTag(tagId);
    setLoading(true);

    try {
      const result = await window.electronAPI.getDigikamImagesByTag(
        settingsStore.digikamDbPath,
        tagId,
        10
      );

      if (result.success && result.images) {
        const imagePaths = result.images.map(img => {
          const fullPath = `${img.specificPath}/${img.name}`;
          return `file://${fullPath}`;
        });

        if (imagePaths.length > 0) {
          onInsertCarousel(imagePaths);
          onClose();
        } else {
          settingsStore.setToast('No images found for this tag', 'error');
        }
      } else {
        settingsStore.setToast(result.error || 'Failed to load images', 'error');
      }
    } catch (error) {
      settingsStore.setToast('Failed to load images from digiKam', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertFile(file);
      onClose();
    }
  };

  const renderTagNode = (tag: TagNode, depth: number = 0): JSX.Element => {
    const hasChildren = tag.children.length > 0;
    const isExpanded = expandedTags.has(tag.id);
    const isSelected = selectedTag === tag.id;

    return (
      <div key={tag.id} style={{ marginLeft: `${depth * 1.5}rem` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            cursor: 'pointer',
            borderRadius: '0.25rem',
            backgroundColor: isSelected ? 'var(--color-bg)' : 'transparent',
          }}
          onClick={() => handleTagSelect(tag.id)}
        >
          {hasChildren && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleTagExpansion(tag.id);
              }}
              style={{
                marginRight: '0.5rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span>{tag.name}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {tag.children.map(child => renderTagNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Insert Image</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasDigikamDb && (
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              <Upload className="h-4 w-4" />
              File
            </button>
            <button
              className={`modal-tab ${activeTab === 'digikam' ? 'active' : ''}`}
              onClick={() => setActiveTab('digikam')}
            >
              <Database className="h-4 w-4" />
              digiKam
            </button>
          </div>
        )}

        <div className="modal-content">
          {activeTab === 'file' && (
            <div className="setting-item">
              <label>Select an image file</label>
              <button
                onClick={handleFileSelect}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem 2rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
              >
                <Upload className="h-5 w-5" />
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {activeTab === 'digikam' && (
            <div className="setting-item">
              <label>Select a tag to insert carousel</label>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-light)' }}>
                  Loading...
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                  }}
                >
                  {tags.length > 0 ? (
                    tags.map(tag => renderTagNode(tag))
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-light)' }}>
                      No tags found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
