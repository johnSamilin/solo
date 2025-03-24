
import { FC } from "react";
import { themes } from "../../../constants";
import { TypographySettings } from "../../../types";

type TypographyProps = {
	settings: TypographySettings;
	setSettings: (newSettings: Partial<TypographySettings>) => void;
};

export const Typography: FC<TypographyProps> = ({ settings, setSettings }) => {

	const handleThemeChange = (themeKey: string) => {
		const theme = themes[themeKey];
		if (theme) {
			setSettings(theme.settings);
		}
	};

	return (
		<>
			<div className="settings-group">
				<h3>Theme</h3>
				<div className="setting-item">
					<label>Select Theme</label>
					<select
						onChange={(e) => handleThemeChange(e.target.value)}
						className="theme-select"
					>
						<option key="Air" value="Air">Custom</option>
						{Object.entries(themes).map(([key, theme]) => (
							<option key={key} value={key}>
								{theme.name}
							</option>
						))}
					</select>
				</div>
			</div>
			<div className="settings-group">
				<h3>Editor</h3>
				<div className="setting-item">
					<label>Font Family</label>
					<select
						value={settings.editorFontFamily}
						onChange={(e) => setSettings({ ...settings, editorFontFamily: e.target.value })}
					>
						<option value="GNU Typewriter">GNU Typewriter</option>
						<option value="Crimson Pro">Crimson Pro</option>
						<option value="Georgia">Georgia</option>
						<option value="Times New Roman">Times New Roman</option>
					</select>
				</div>
				<div className="setting-item">
					<label>Font Size</label>
					<select
						value={settings.editorFontSize}
						onChange={(e) => setSettings({ ...settings, editorFontSize: e.target.value })}
					>
						<option value="1rem">Small</option>
						<option value="1.125rem">Medium</option>
						<option value="1.25rem">Large</option>
					</select>
				</div>
				<div className="setting-item">
					<label>Line Height</label>
					<select
						value={settings.editorLineHeight}
						onChange={(e) => setSettings({ ...settings, editorLineHeight: e.target.value })}
					>
						<option value="1.5">Compact</option>
						<option value="1.75">Comfortable</option>
						<option value="2">Spacious</option>
					</select>
				</div>
			</div>
			<div className="settings-group">
				<h3>Title</h3>
				<div className="setting-item">
					<label>Font Family</label>
					<select
						value={settings.titleFontFamily}
						onChange={(e) => setSettings({ ...settings, titleFontFamily: e.target.value })}
					>
						<option value="GNU Typewriter">GNU Typewriter</option>
						<option value="Crimson Pro">Crimson Pro</option>
						<option value="Georgia">Georgia</option>
					</select>
				</div>
				<div className="setting-item">
					<label>Font Size</label>
					<select
						value={settings.titleFontSize}
						onChange={(e) => setSettings({ ...settings, titleFontSize: e.target.value })}
					>
						<option value="1.5rem">Small</option>
						<option value="2rem">Medium</option>
						<option value="2.5rem">Large</option>
					</select>
				</div>
			</div>
			<div className="settings-group">
				<h3>Sidebar</h3>
				<div className="setting-item">
					<label>Font Family</label>
					<select
						value={settings.sidebarFontFamily}
						onChange={(e) => setSettings({ ...settings, sidebarFontFamily: e.target.value })}
					>
						<option value="GNU Typewriter">GNU Typewriter</option>
						<option value="Crimson Pro">Crimson Pro</option>
						<option value="Georgia">Georgia</option>
					</select>
				</div>
				<div className="setting-item">
					<label>Font Size</label>
					<select
						value={settings.sidebarFontSize}
						onChange={(e) => setSettings({ ...settings, sidebarFontSize: e.target.value })}
					>
						<option value="0.875rem">Small</option>
						<option value="1rem">Medium</option>
						<option value="1.125rem">Large</option>
					</select>
				</div>
			</div>
		</>
	);
};
