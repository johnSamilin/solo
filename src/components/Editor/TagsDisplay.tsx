import { X, Tag } from "lucide-react";
import { FC } from "react";
import { Note } from "../../types";

type TagsDisplayProps = {
	selectedNote: Note;
	removeTagFromNote: (tagId: string) => void;
	setIsTagModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const TagsDisplay: FC<TagsDisplayProps> = ({
	selectedNote,
	removeTagFromNote,
	setIsTagModalOpen,
}) => {
	return (
		<div className="tags-container">
			{selectedNote.tags.map(tag => (
				<div key={tag.id} className="tag">
					<span className="tag-path">{tag.path}</span>
					<button
						onClick={() => removeTagFromNote(tag.id)}
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
	);
};
