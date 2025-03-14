import { Editor } from "@tiptap/react";
import { Undo2, Redo2, ImageIcon, LinkIcon, EyeOff, ListChecks, Minimize2, Maximize2, Leaf } from "lucide-react";
import { FC } from "react";

type FABProps = {
	editor: Editor | null;
	isZenMode: boolean;
	toggleZenMode: () => void;
	isToolbarExpanded: boolean;
	handleImageUpload: () => void;
	handleLinkInsert: () => void;
	insertTaskList: () => void;
	setIsToolbarExpanded: (val: boolean) => void;
};

export const FAB: FC<FABProps> = ({
	editor,
	isZenMode,
	toggleZenMode,
	isToolbarExpanded,
	handleImageUpload,
	handleLinkInsert,
	insertTaskList,
	setIsToolbarExpanded,
}) => {
	return (
		<div className={`editor-toolbar ${isToolbarExpanded ? 'expanded' : ''}`}>
			<div className="toolbar-actions" onClick={() => setIsToolbarExpanded(false)}>
				<div className="editor-toolbar-group">
					<button
						onClick={() => editor?.commands.undo()}
						className="button-icon"
						disabled={!editor?.can().undo()}
						title="Undo (Ctrl+Z)"
					>
						<Undo2 className="h-4 w-4" />
					</button>
					<button
						onClick={() => editor?.commands.redo()}
						className="button-icon"
						disabled={!editor?.can().redo()}
						title="Redo (Ctrl+Shift+Z)"
					>
						<Redo2 className="h-4 w-4" />
					</button>
				</div>
				<div className="editor-toolbar-group">
					<button
						onClick={handleImageUpload}
						className="button-icon"
						title="Insert Image"
					>
						<ImageIcon className="h-4 w-4" />
					</button>
					<button
						onClick={handleLinkInsert}
						className="button-icon"
						title="Insert Link"
					>
						<LinkIcon className="h-4 w-4" />
					</button>
					<button
						onClick={() => editor?.commands.toggleCensored()}
						className="button-icon"
						title="Toggle Censored Text (Ctrl+Alt+X)"
					>
						<EyeOff className="h-4 w-4" />
					</button>
					<button
						onClick={insertTaskList}
						className="button-icon"
						title="Insert Task List"
					>
						<ListChecks className="h-4 w-4" />
					</button>
				</div>
				<div className="editor-toolbar-group">
					<button
						onClick={toggleZenMode}
						className="button-icon"
						title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
					>
							<Leaf className="h-4 w-4" />
					</button>
				</div>
			</div>
			<button
				onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
				className="button-icon toggle-button"
				title="Toggle toolbar"
			>
				{isToolbarExpanded ? (
					<Minimize2 className="h-4 w-4" />
				) : (
					<Maximize2 className="h-4 w-4" />
				)}
			</button>
		</div>
	);
};