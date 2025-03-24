import { X, Tag } from "lucide-react";
import { FC } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores/StoreProvider";

import './TagsDisplay.css';

export const TagsDisplay: FC = observer(() => {
	const { notesStore, settingsStore } = useStore();

	if (!notesStore.selectedNote) return null;

	return (
		<div className="tags-container">
			{notesStore.selectedNote.tags.map(tag => (
				<div key={tag.id} className="tag">
					<span className="tag-path">{tag.path}</span>
					<button
						onClick={() => notesStore.removeTagFromNote(notesStore.selectedNote!.id, tag.id)}
						className="tag-remove"
					>
						<X className="h-3 w-3" />
					</button>
				</div>
			))}
			<button
				onClick={() => settingsStore.setTagModalOpen(true)}
				className="add-tag-button"
			>
				<Tag className="h-4 w-4" />
				Add Tag
			</button>
		</div>
	);
});