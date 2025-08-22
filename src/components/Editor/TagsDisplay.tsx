import { X, Tag } from "lucide-react";
import { FC, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores/StoreProvider";
import { Tag as TagType } from "../../types";
import { TagModal } from "../Modals/TagModal/TagModal";

import './TagsDisplay.css';

export const TagsDisplay: FC = observer(() => {
	const { notesStore } = useStore();
	const [isTagModalOpen, setIsTagModalOpen] = useState(false);

	if (!notesStore.selectedNote) return null;

	const handleApplyTags = (selectedTags: TagType[]) => {
		if (notesStore.selectedNote) {
			notesStore.updateNote(notesStore.selectedNote.id, {
				tags: selectedTags
			});
		}
	};

	return (
		<>
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
					onClick={() => setIsTagModalOpen(true)}
					className="add-tag-button"
				>
					<Tag className="h-4 w-4" />
					Add Tag
				</button>
			</div>

			<TagModal
				isOpen={isTagModalOpen}
				onClose={() => setIsTagModalOpen(false)}
				appliedTags={notesStore.selectedNote.tags}
				onApply={handleApplyTags}
				title="Manage Note Tags"
			/>
		</>
	);
});