import { FC, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X, Upload, Tag } from 'lucide-react';
import { useStore } from '../../stores/StoreProvider';
import { queryDigikamTags, queryDigikamPhotos } from '../../utils/digikam';
import { TagNode } from '../../types';

interface InsertImageModalProps {
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onDigikamPhotos: (photos: string[]) => void;
}

export const InsertImageModal: FC<InsertImageModalProps> = observer(({
  onClose,
  onFileSelect,
  onDigikamPhotos,
}) => {
  const { settingsStore } = useStore();
  const [mode, setMode] = useState<'choose' | 'file' | 'digikam'>('choose');
  const [tagTree, setTagTree] = useState<TagNode[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDigikam = !!settingsStore.digikamDbPath;

  useEffect(() => {
    if (mode === 'digikam' && hasDigikam) {
      loadDigikamTags();
    }
  }, [mode, hasDigikam]);

  const loadDigikamTags = async () => {
    if (!settingsStore.digikamDbPath) return;

    setIsLoading(true);
    setError(null);

    try {
      const tags = await queryDigikamTags(settingsStore.digikamDbPath);
      setTagTree(tags);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onFileSelect(file);
        onClose();
      }
    };
    input.click();
  };

  const handleTagSelect = async () => {
    if (!selectedTagId || !settingsStore.digikamDbPath) return;

    setIsLoading(true);
    setError(null);

    try {
      const photos = await queryDigikamPhotos(settingsStore.digikamDbPath, selectedTagId);
      if (photos.length === 0) {
        setError('No photos found for this tag');
        return;
      }
      onDigikamPhotos(photos);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    const updateTree = (nodes: TagNode[]): TagNode[] => {
      return nodes.map(node => {
        if (node.id === tagId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };
    setTagTree(updateTree(tagTree));
  };

  const renderTagTree = (nodes: TagNode[], depth: number = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ marginLeft: `${depth * 1}rem` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            cursor: 'pointer',
            backgroundColor: selectedTagId === node.id ? '#e3f2fd' : 'transparent',
            borderRadius: '4px',
            marginBottom: '0.25rem',
          }}
        >
          {node.children.length > 0 && (
            <span
              onClick={() => toggleTag(node.id)}
              style={{
                marginRight: '0.5rem',
                userSelect: 'none',
                width: '1rem',
              }}
            >
              {node.isExpanded ? '▼' : '▶'}
            </span>
          )}
          {node.children.length === 0 && (
            <span style={{ marginRight: '0.5rem', width: '1rem' }}></span>
          )}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <input
              type="radio"
              name="tag"
              checked={selectedTagId === node.id}
              onChange={() => setSelectedTagId(node.id)}
              style={{ marginRight: '0.5rem' }}
            />
            {node.name}
          </label>
        </div>
        {node.isExpanded && node.children.length > 0 && renderTagTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Insert Image</h2>
          <button className="button-icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-content">
          {mode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => setMode('file')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                <Upload className="h-5 w-5" />
                Pick from file system
              </button>

              {hasDigikam && (
                <button
                  onClick={() => setMode('digikam')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  <Tag className="h-5 w-5" />
                  Select from digiKam tag
                </button>
              )}
            </div>
          )}

          {mode === 'file' && (
            <div>
              <button
                onClick={handleFileSelect}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                <Upload className="h-5 w-5" />
                Choose file
              </button>
              <button
                onClick={() => setMode('choose')}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            </div>
          )}

          {mode === 'digikam' && (
            <div>
              {error && (
                <div style={{ color: 'red', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading tags...
                </div>
              ) : (
                <>
                  <div
                    style={{
                      maxHeight: '400px',
                      overflowY: 'auto',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      marginBottom: '1rem',
                    }}
                  >
                    {tagTree.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        No tags found in digiKam database
                      </div>
                    ) : (
                      renderTagTree(tagTree)
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleTagSelect}
                      disabled={!selectedTagId || isLoading}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: selectedTagId ? '#28a745' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedTagId ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Insert photos (max 10)
                    </button>
                    <button
                      onClick={() => setMode('choose')}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'transparent',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
