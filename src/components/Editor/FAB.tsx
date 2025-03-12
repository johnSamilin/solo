import { Editor } from "@tiptap/react";
import { MoreVertical, Undo2, Redo2, ImageIcon, LinkIcon, EyeOff, ListChecks, Settings, Minimize2, Maximize2 } from "lucide-react";
import { FC } from "react";

type FABProps = {
	editor: Editor | null;
	setIsSettingsOpen: (val: boolean) => void;
	isZenMode: boolean;
	toggleZenMode: () => void;
	isToolbarExpanded: boolean
	handleImageUpload: (event: React.MouseEvent<HTMLButtonElement>) => void;
	handleLinkInsert: () => void;
	insertTaskList: () => void;
	setIsToolbarExpanded: (val: boolean) => void;
};

export const FAB: FC<FABProps> = ({
	editor,
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
		<div className={`editor-toolbar ${isToolbarExpanded ? 'expanded' : ''}`}>
			<button
				onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
				className="button-icon toggle-button"
				title="Toggle toolbar"
			>
				<MoreVertical className="h-4 w-4" />
			</button>
			<div className="toolbar-actions">
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
						onClick={() => setIsSettingsOpen(true)}
						className="button-icon"
						title="Typography Settings"
					>
						<Settings className="h-4 w-4" />
					</button>
					<button
						onClick={toggleZenMode}
						className="button-icon"
						title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
					>
						{isZenMode ? (
							<Minimize2 className="h-4 w-4" />
						) : (
							<Maximize2 className="h -4 w-4" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
