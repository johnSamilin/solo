import { ChevronDown, ChevronRight } from "lucide-react";
import { TagNode } from "../types";

export function TagTreeItem({ node, level = 0, onToggle, onCheck }: {
	node: TagNode;
	level?: number;
	onToggle: (nodeId: string) => void;
	onCheck: (nodeId: string) => void;
}) {
	return (
		<div className="tag-tree-item" style={{ paddingLeft: `${level * 1.5}rem` }}>
			<div className="tag-tree-item-header">
				{node.children.length > 0 && (
					<button
						className="tag-tree-toggle"
						onClick={() => onToggle(node.id)}
					>
						{node.isExpanded ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</button>
				)}
				<label className="tag-tree-label">
					<input
						type="checkbox"
						checked={node.isChecked}
						onChange={() => onCheck(node.id)}
						className="tag-tree-checkbox"
					/>
					<span>{node.name}</span>
				</label>
			</div>
			{node.isExpanded && node.children.length > 0 && (
				<div className="tag-tree-children">
					{node.children.map(child => (
						<TagTreeItem
							key={child.id}
							node={child}
							level={level + 1}
							onToggle={onToggle}
							onCheck={onCheck}
						/>
					))}
				</div>
			)}
		</div>
	);
}