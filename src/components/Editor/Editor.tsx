import { EditorContent } from "@tiptap/react";
import { X, Tag } from "lucide-react";
import { FC } from "react";
import { Editor as TEditor } from "@tiptap/react";
import { Note } from "../../types";
import { FAB } from "./FAB";
import { TagsDisplay } from "./TagsDisplay";

type EditorProps = {
	selectedNote: Note;
	handleTitleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	editor: TEditor | null;
	wordCount: number;
	paragraphCount: number;
	removeTagFromNote: (tagId: string) => void;
	setIsTagModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	isZenMode: boolean;
	toggleZenMode: () => void;
	isToolbarExpanded: boolean;
	handleImageUpload: (event: React.MouseEvent<HTMLButtonElement>) => void;
	handleLinkInsert: () => void;
	insertTaskList: () => void;
	setIsToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
};

export const Editor: FC<EditorProps> = ({
	selectedNote,
	handleTitleChange,
	editor,
	wordCount,
	paragraphCount,
	removeTagFromNote,
	setIsTagModalOpen,
	setIsSettingsOpen,
	isZenMode,
	toggleZenMode,
	isToolbarExpanded,
	handleImageUpload,
	handleLinkInsert,
	insertTaskList,
	setIsToolbarExpanded,
}) => {
	return (
		<div className="editor">
			<div className="editor-container">
				<div className="editor-content">
					<input
						type="text"
						value={selectedNote.title}
						onChange={handleTitleChange}
						className="editor-title"
						placeholder="Note Title"
					/>
					<EditorContent editor={editor} className="editor-body" />
					{/* Tags Display */}
					<TagsDisplay
						selectedNote={selectedNote}
						setIsTagModalOpen={setIsTagModalOpen}
						removeTagFromNote={removeTagFromNote}
					/>
					<div className="word-count">
						{wordCount}/{paragraphCount}
					</div>
				</div>
				{/* Floating Action Button Toolbar */}
				<FAB
					editor={editor}
					setIsSettingsOpen={setIsSettingsOpen}
					isZenMode={isZenMode}
					toggleZenMode={toggleZenMode}
					isToolbarExpanded={isToolbarExpanded}
					handleImageUpload={handleImageUpload}
					handleLinkInsert={handleLinkInsert}
					insertTaskList={insertTaskList}
					setIsToolbarExpanded={setIsToolbarExpanded}
				/>
			</div>
		</div>
	);
};
