import { X } from "lucide-react";
import { FC, useState } from "react";
import { Tag, TagNode } from "../../types";
import { TagTreeItem } from "../Sidebar/TagTreeItem";
import { generateUniqueId, buildTagTree } from "../../utils";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores/StoreProvider";

import './Modals.css';

type TagModalProps = {
	onClose: () => void;
};

export const TagModal: FC<TagModalProps> = observer(({
	onClose,
}) => {
	const [newTagPath, setNewTagPath] = useState('');
	const { notesStore, settingsStore, tagsStore } = useStore();

	const applySelectedTags = () => {
		const getSelectedTags = (nodes: TagNode[], parentPath = '') => {
			return nodes.flatMap(node => {
				const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
				const tags = [];

				if (node.isChecked) {
					tags.push(tagsStore.createTag(currentPath));
				}

				if (node.children.length > 0) {
					tags.push(...getSelectedTags(node.children, currentPath));
				}

				return tags;
			});
		};

		if (notesStore.selectedNote) {
			const selectedTags = getSelectedTags(tagsStore.tagTree);
			notesStore.updateNote(notesStore.selectedNote.id, {
				tags: selectedTags
			});
		}
		settingsStore.setTagModalOpen(false);
	}

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

		tagsStore.setTagTree(updateNodes(tagsStore.tagTree));
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

		tagsStore.setTagTree(updateNodes(tagsStore.tagTree));
	};

	const handleNewTagSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTagPath.trim() || !notesStore.selectedNote) return;

		const newTag: Tag = {
			id: generateUniqueId(),
			path: newTagPath.trim()
		};

		const updatedNote = {
			...notesStore.selectedNote,
			tags: [...notesStore.selectedNote.tags, newTag]
		};

		notesStore.setSelectedNote(updatedNote);
		notesStore.notes = notesStore.notes.map(note =>
			note.id === updatedNote.id ? updatedNote : note
		);

		const allTags = Array.from(new Set([
			...notesStore.notes.flatMap(note => note.tags.map(tag => tag.path)),
			newTag.path
		])).map(path => ({ id: generateUniqueId(), path }));

		const tree = buildTagTree(allTags);
		tagsStore.setTagTree(tree);
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
						{tagsStore.tagTree.map(node => (
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
});
