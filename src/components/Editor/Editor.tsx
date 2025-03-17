import { EditorContent } from "@tiptap/react";
import { FC, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Editor as TEditor } from "@tiptap/react";
import { useStore } from "../../stores/StoreProvider";
import { FAB } from "./FAB";
import { TagsDisplay } from "./TagsDisplay";

type EditorProps = {
	editor: TEditor | null;
	handleImageUpload: () => void;
	handleLinkInsert: () => void;
	insertTaskList: () => void;
};

export const Editor: FC<EditorProps> = observer(({
	editor,
	handleImageUpload,
	handleLinkInsert,
	insertTaskList,
}) => {
	const { notesStore, settingsStore } = useStore();
  useEffect(() => {
    if (settingsStore.isZenMode) {
      document.body.requestFullscreen();
    } else {
      document.exitFullscreen();
    }

    function onFSChange() {
      if (!document.fullscreenElement) {
        settingsStore.turnZenModeOff();
      }
    }

    document.body.addEventListener('fullscreenchange', onFSChange);
    return () => {
      document.body.removeEventListener('fullscreenchange', onFSChange);
    };
  }, [settingsStore.isZenMode]);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (notesStore.selectedNote) {
			notesStore.updateNote(notesStore.selectedNote.id, {
				title: e.target.value,
			});
		}
	};

	const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length || 0;
	const paragraphCount = editor?.state.doc.content.content.filter(
		node => node.type.name === 'paragraph' || node.type.name === 'heading'
	).length || 0;

	if (!notesStore.selectedNote) return null;

	return (
		<div className="editor">
			<div className="editor-container">
				<div className="editor-content">
					<input
						type="text"
						value={notesStore.selectedNote.title}
						onChange={handleTitleChange}
						className="editor-title"
						placeholder="Note Title"
					/>
					<p className="note-item-date">
						{new Date(notesStore.selectedNote.createdAt).toLocaleDateString()}
					</p>
					<EditorContent editor={editor} className="editor-body" />
					{/* Tags Display */}
					<TagsDisplay />
					<div className="word-count">
						{wordCount}/{paragraphCount}
					</div>
				</div>
				{/* Floating Action Button Toolbar */}
				<FAB
					editor={editor}
					isZenMode={settingsStore.isZenMode}
					toggleZenMode={settingsStore.toggleZenMode}
					isToolbarExpanded={settingsStore.isToolbarExpanded}
					handleImageUpload={handleImageUpload}
					handleLinkInsert={handleLinkInsert}
					insertTaskList={insertTaskList}
					setIsToolbarExpanded={(expanded) => settingsStore.isToolbarExpanded = expanded}
					setIsSettingsOpen={settingsStore.setSettingsOpen}
				/>
			</div>
		</div>
	);
});