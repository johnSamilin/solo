import { useState, useEffect } from 'react';
import { Folder, File, RefreshCw, Save, FileJson, FolderTree, Tags, Maximize2, Minimize2, Search, Plus, BookOpen, FileText } from 'lucide-react';

interface FileMetadata {
  id: string;
  tags: string[];
  createdAt: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface SearchResult {
  path: string;
  type: 'filename' | 'content' | 'metadata';
  matches: string[];
  metadata?: FileMetadata;
}

function App() {
  const [dataFolder, setDataFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [metadata, setMetadata] = useState<FileMetadata>({
    id: '',
    tags: [],
    createdAt: new Date().toISOString().split('T')[0],
  });
  const [structure, setStructure] = useState<FileNode[]>([]);
  const [status, setStatus] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTagInput, setSearchTagInput] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState<'none' | 'notebook' | 'note'>('none');
  const [createName, setCreateName] = useState<string>('');
  const [selectedParentPath, setSelectedParentPath] = useState<string>('.');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDataFolder().then((result) => {
        if (result.success && result.path) {
          setDataFolder(result.path);
          loadStructure();
        }
      });

      window.electronAPI.getZenMode().then((result) => {
        if (result.success && result.isZenMode !== undefined) {
          setIsZenMode(result.isZenMode);
        }
      });
    }
  }, []);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    const result = await window.electronAPI.selectFolder();
    if (result.success && result.path) {
      setDataFolder(result.path);
      setStatus(`Selected folder: ${result.path}`);
      await loadStructure();
    } else {
      setStatus(`Error: ${result.error || 'Unknown error'}`);
    }
  };

  const loadStructure = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.readStructure();
    console.log({result})
    if (result.success && result.structure) {
      setStructure(result.structure);
      setStatus('File structure loaded');
    } else {
      setStatus(`Error loading structure: ${result.error || 'Unknown error'}`);
    }
  };

  const handleOpenFile = async () => {
    if (!window.electronAPI || !selectedFile) {
      setStatus('Please enter a file path');
      return;
    }

    const result = await window.electronAPI.openFile(selectedFile);
    if (result.success && result.content !== undefined) {
      setFileContent(result.content);
      setStatus(`Opened file: ${selectedFile}`);

      const metadataPath = selectedFile.replace(/\.[^/.]+$/, '.json');
      const metadataResult = await window.electronAPI.openFile(metadataPath);
      if (metadataResult.success && metadataResult.content) {
        try {
          const parsedMetadata = JSON.parse(metadataResult.content);
          setMetadata(parsedMetadata);
        } catch (e) {
          setMetadata({
            id: '',
            tags: [],
            createdAt: new Date().toISOString().split('T')[0],
          });
        }
      }
    } else {
      setStatus(`Error: ${result.error || 'Unknown error'}`);
    }
  };

  const handleUpdateFile = async () => {
    if (!window.electronAPI || !selectedFile) {
      setStatus('Please select a file first');
      return;
    }

    const result = await window.electronAPI.updateFile(selectedFile, fileContent);
    if (result.success) {
      setStatus(`Updated file: ${selectedFile}`);
      await loadStructure();
    } else {
      setStatus(`Error: ${result.error || 'Unknown error'}`);
    }
  };

  const handleUpdateMetadata = async () => {
    if (!window.electronAPI || !selectedFile) {
      setStatus('Please select a file first');
      return;
    }

    const result = await window.electronAPI.updateMetadata(selectedFile, metadata);
    if (result.success) {
      setStatus(`Updated metadata: ${result.path}`);
      await loadStructure();
    } else {
      setStatus(`Error: ${result.error || 'Unknown error'}`);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      setMetadata({
        ...metadata,
        tags: [...metadata.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setMetadata({
      ...metadata,
      tags: metadata.tags.filter((_, i) => i !== index),
    });
  };

  const handleScanAllTags = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    const result = await window.electronAPI.scanAllTags();
    if (result.success && result.tags) {
      setAllTags(result.tags);
      setStatus(`Found ${result.tags.length} unique tags`);
    } else {
      setStatus(`Error scanning tags: ${result.error || 'Unknown error'}`);
    }
  };

  const handleToggleZenMode = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    const newZenMode = !isZenMode;
    const result = await window.electronAPI.toggleZenMode(newZenMode);
    if (result.success) {
      setIsZenMode(newZenMode);
      setStatus(newZenMode ? 'Entered Zen Mode (fullscreen)' : 'Exited Zen Mode');
    } else {
      setStatus(`Error toggling Zen Mode: ${result.error || 'Unknown error'}`);
    }
  };

  const handleSearch = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    const result = await window.electronAPI.search(
      searchQuery || undefined,
      searchTags.length > 0 ? searchTags : undefined
    );

    if (result.success && result.results) {
      setSearchResults(result.results);
      setStatus(`Found ${result.results.length} result(s)`);
    } else {
      setStatus(`Search error: ${result.error || 'Unknown error'}`);
    }
  };

  const handleAddSearchTag = () => {
    if (searchTagInput.trim() && !searchTags.includes(searchTagInput.trim())) {
      setSearchTags([...searchTags, searchTagInput.trim()]);
      setSearchTagInput('');
    }
  };

  const handleRemoveSearchTag = (index: number) => {
    setSearchTags(searchTags.filter((_, i) => i !== index));
  };

  const handleSelectParentFolder = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    const result = await window.electronAPI.selectParentFolder();
    if (result.success && result.path) {
      setSelectedParentPath(result.path);
      setStatus(`Selected parent folder: ${result.path}`);
    } else if (result.error) {
      setStatus(`Error: ${result.error}`);
    }
  };

  const handleCreateNotebook = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    if (!createName.trim()) {
      setStatus('Notebook name is required');
      return;
    }

    const result = await window.electronAPI.createNotebook(selectedParentPath, createName);
    if (result.success && result.path) {
      setStatus(`Created notebook: ${result.path}`);
      setShowCreateDialog('none');
      setCreateName('');
      loadStructure();
    } else {
      setStatus(`Error creating notebook: ${result.error || 'Unknown error'}`);
    }
  };

  const handleCreateNote = async () => {
    if (!window.electronAPI) {
      setStatus('Electron API not available. Run in Electron environment.');
      return;
    }

    if (!createName.trim()) {
      setStatus('Note name is required');
      return;
    }

    const result = await window.electronAPI.createNote(selectedParentPath, createName);
    if (result.success && result.htmlPath) {
      setStatus(`Created note: ${result.htmlPath}`);
      setShowCreateDialog('none');
      setCreateName('');
      setSelectedFile(result.htmlPath);
      loadStructure();
    } else {
      setStatus(`Error creating note: ${result.error || 'Unknown error'}`);
    }
  };

  const renderFileTree = (nodes: FileNode[], level = 0): JSX.Element[] => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${level * 20}px` }} className="py-1">
        <div
          className="flex items-center gap-2 hover:bg-slate-100 p-1 rounded cursor-pointer"
          onClick={() => {
            if (node.type === 'file') {
              setSelectedFile(node.path);
            }
          }}
        >
          {node.type === 'folder' ? (
            <Folder className="w-4 h-4 text-blue-600" />
          ) : (
            <File className="w-4 h-4 text-slate-600" />
          )}
          <span className="text-sm font-mono">{node.name}</span>
        </div>
        {node.children && renderFileTree(node.children, level + 1)}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Solo</h1>
          <p className="text-slate-600 mb-6">Desktop file management application with metadata support</p>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleSelectFolder}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <Folder className="w-5 h-5" />
                Select Data Folder
              </button>
              {dataFolder && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
                  <span className="text-sm text-slate-600">Current folder:</span>
                  <span className="text-sm font-mono text-slate-800">{dataFolder}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateDialog('notebook')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                title="Create Notebook"
              >
                <BookOpen className="w-4 h-4" />
                New Notebook
              </button>
              <button
                onClick={() => setShowCreateDialog('note')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                title="Create Note"
              >
                <FileText className="w-4 h-4" />
                New Note
              </button>
              <button
                onClick={handleToggleZenMode}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
              >
                {isZenMode ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    Exit Zen
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    Zen Mode
                  </>
                )}
              </button>
            </div>
          </div>

          {status && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{status}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <FolderTree className="w-5 h-5" />
                File Structure
              </h2>
              <button
                onClick={loadStructure}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {structure.length > 0 ? (
                renderFileTree(structure)
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">
                  No data folder selected or folder is empty
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <File className="w-5 h-5" />
                File Operations
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    File Path (relative to data folder)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedFile}
                      onChange={(e) => setSelectedFile(e.target.value)}
                      placeholder="e.g., documents/example.txt"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleOpenFile}
                      className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    File Content
                  </label>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    placeholder="File content will appear here..."
                    rows={8}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <button
                    onClick={handleUpdateFile}
                    className="mt-2 flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save File
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                Metadata
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ID</label>
                  <input
                    type="text"
                    value={metadata.id}
                    onChange={(e) => setMetadata({ ...metadata, id: e.target.value })}
                    placeholder="Unique identifier"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={metadata.createdAt}
                    onChange={(e) => setMetadata({ ...metadata, createdAt: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add a tag"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {metadata.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(index)}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleUpdateMetadata}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Metadata
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                  <Tags className="w-5 h-5" />
                  All Tags
                </h2>
                <button
                  onClick={handleScanAllTags}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Scan Tags
                </button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[60px] p-4 border border-slate-200 rounded-lg">
                {allTags.length > 0 ? (
                  allTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 self-center w-full text-center">
                    Click "Scan Tags" to find all tags across metadata files
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Search Query
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search in filenames and content..."
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Filter by Tags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={searchTagInput}
                      onChange={(e) => setSearchTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSearchTag()}
                      placeholder="Add tag to filter"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAddSearchTag}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {searchTags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveSearchTag(index)}
                          className="hover:text-green-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Search className="w-5 h-5" />
                  Search
                </button>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    Results ({searchResults.length})
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                          onClick={() => setSelectedFile(result.path)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono text-slate-800 font-medium">
                              {result.path}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {result.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {result.matches.map((match, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded"
                              >
                                {match}
                              </span>
                            ))}
                          </div>
                          {result.metadata && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {result.metadata.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No results. Enter a search query or add tags to filter.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCreateDialog !== 'none' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                {showCreateDialog === 'notebook' ? (
                  <>
                    <BookOpen className="w-6 h-6" />
                    Create Notebook
                  </>
                ) : (
                  <>
                    <FileText className="w-6 h-6" />
                    Create Note
                  </>
                )}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {showCreateDialog === 'notebook' ? 'Notebook' : 'Note'} Name
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        showCreateDialog === 'notebook' ? handleCreateNotebook() : handleCreateNote();
                      }
                    }}
                    placeholder={`Enter ${showCreateDialog} name...`}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Parent Folder
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedParentPath}
                      readOnly
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                    />
                    <button
                      onClick={handleSelectParentFolder}
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                    >
                      Browse
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateDialog('none');
                      setCreateName('');
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showCreateDialog === 'notebook' ? handleCreateNotebook : handleCreateNote}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
