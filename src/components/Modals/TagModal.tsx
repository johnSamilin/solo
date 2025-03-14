import { X } from "lucide-react";
import { FC, useState } from "react";
import { Note, Tag, TagNode } from "../../types";
import { TagTreeItem } from "../TagTreeItem";
import { generateUniqueId, buildTagTree } from "../../utils";

type TagModalProps = {
	onClose: () => void;
	tagTree: TagNode[];
	setTagTree: (tags: TagNode[]) => void;
	selectedNote: Note | null;
	setSelectedNote: (note: Note | null) => void
	setNotes: (notes: Note[]) => void
	notes: Note[]
	applySelectedTags: () => void
};

export const TagModal: FC<TagModalProps> = ({
	onClose,
	tagTree,
	setTagTree,
	selectedNote,
	setSelectedNote,
	setNotes,
	notes,
	applySelectedTags,
}) => {
	const [newTagPath, setNewTagPath] = useState('');

	const toggleTagNode = (nodeId: string) => {
		const updateNodes = (nodes: TagNode[]): TagNode[] => {
			return nodes.map(node => {
				if (node.id === nodeId) {
					return { ...node, isExpanded: !node.isExpanded };
				}
				if (node.children.length > 0) {
					return { ...node, children: updateNodes(node.children) };
				}
				return node;
			});
		};

		setTagTree(updateNodes(tagTree));
	};

	const toggleTagCheck = (nodeId: string) => {
		const updateNodes = (nodes: TagNode[]): TagNode[] => {
			return nodes.map(node => {
				if (node.id === nodeId) {
					return { ...node, isChecked: !node.isChecked };
				}
				if (node.children.length > 0) {
					return { ...node, children: updateNodes(node.children) };
				}
				return node;
			});
		};

		setTagTree(updateNodes(tagTree));
	};

	const handleNewTagSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTagPath.trim() || !selectedNote) return;

		const newTag: Tag = {
			id: generateUniqueId(),
			path: newTagPath.trim()
		};

		const updatedNote = {
			...selectedNote,
			tags: [...selectedNote.tags, newTag]
		};

		setSelectedNote(updatedNote);
		setNotes(notes.map(note =>
			note.id === updatedNote.id ? updatedNote : note
		));

		const allTags = Array.from(new Set([
			...notes.flatMap(note => note.tags.map(tag => tag.path)),
			newTag.path
		])).map(path => ({ id: generateUniqueId(), path }));

		const tree = buildTagTree(allTags);
		setTagTree(tree);
		setNewTagPath('');
	};

	return (
		<div className="modal-overlay">
			<div className="modal">
				<div className="modal-header">
					<h2>Manage Tags</h2>
					<button className="button-icon" onClick={() => onClose()}>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div className="modal-content">
					<div className="tag-tree">
						{tagTree.map(node => (
							<TagTreeItem
								key={node.id}
								node={node}
								onToggle={toggleTagNode}
								onCheck={toggleTagCheck}
							/>
						))}
					</div>
					<form onSubmit={handleNewTagSubmit} className="tag-input-container">
						<input
							type="text"
							value={newTagPath}
							onChange={(e) => setNewTagPath(e.target.value)}
							className="tag-input"
							placeholder="Add new tag (e.g., work/projects/active)"
						/>
						<button type="submit" className="tag-apply-button">
							Add Tag
						</button>
					</form>
					<div className="tag-modal-actions">
						<button
							onClick={applySelectedTags}
							className="tag-apply-button"
						>
							Apply Selected Tags
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
