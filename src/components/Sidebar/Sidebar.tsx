import { Plus, FolderPlus, MoreVertical, Settings } from "lucide-react";
import { FC, useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { NotebookItem } from "./NotebookItem";
import { useStore } from "../../stores/StoreProvider";
import { Editor } from "@tiptap/react";

import './Sidebar.css';

type SidebarProps = {
	editor: Editor | null;
};

export const Sidebar: FC<SidebarProps> = observer(({ editor }) => {
	const { notesStore, settingsStore } = useStore();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				buttonRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleCreateNote = () => {
		notesStore.createNote();
		if (editor) {
			editor.commands.setContent('');
		}
		setIsMenuOpen(false);
	};

	const handleCreateNotebook = () => {
		settingsStore.setNewNotebookModalOpen(true);
		setIsMenuOpen(false);
	};

	const handleOpenSettings = () => {
		settingsStore.setSettingsOpen(true);
		setIsMenuOpen(false);
	};

	return (
		<div className={`sidebar ${settingsStore.isZenMode ? 'hidden' : ''}`}>
			<div className="sidebar-header">
				<div className="relative">
					<button
						ref={buttonRef}
						className="sidebar-menu-button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						aria-label="Menu"
						aria-expanded={isMenuOpen}
					>
						<MoreVertical className="h-4 w-4" />
					</button>
					{isMenuOpen && (
						<div
							ref={menuRef}
							className="sidebar-dropdown"
							role="menu"
						>
							<button
								className="sidebar-dropdown-item"
								onClick={handleCreateNote}
								role="menuitem"
							>
								<Plus className="h-4 w-4" />
								New Note
							</button>
							<button
								className="sidebar-dropdown-item"
								onClick={handleCreateNotebook}
								role="menuitem"
							>
								<FolderPlus className="h-4 w-4" />
								New Notebook
							</button>
							<button
								className="sidebar-dropdown-item"
								onClick={handleOpenSettings}
								role="menuitem"
							>
								<Settings className="h-4 w-4" />
								Settings
							</button>
						</div>
					)}
				</div>
			</div>

			<div className="notebooks-list">
				{notesStore.notebooks
					.filter(notebook => notebook.parentId === null)
					.map(notebook => (
						<NotebookItem
							key={notebook.id}
							notebook={notebook}
							editor={editor}
						/>
					))}
			</div>
		</div>
	);
});