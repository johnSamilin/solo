import { FC } from "react";
import { TypographySettings } from "../../../types";

type LayoutProps = {
	settings: TypographySettings;
	setSettings: (newSettings: Partial<TypographySettings>) => void;
};

export const Layout: FC<LayoutProps> = ({ settings, setSettings }) => {
	return (
		<div className="settings-group">
			<h3>Layout</h3>
			<div className="setting-item">
				<label>Page Margins</label>
				<select
					value={settings.pageMargins}
					onChange={(e) => setSettings({ ...settings, pageMargins: e.target.value })}
				>
					<option value="1rem">Narrow</option>
					<option value="2rem">Medium</option>
					<option value="3rem">Wide</option>
				</select>
			</div>
			<div className="setting-item">
				<label>Maximum Width</label>
				<select
					value={settings.maxEditorWidth}
					onChange={(e) => setSettings({ ...settings, maxEditorWidth: e.target.value })}
				>
					<option value="50%">Narrow</option>
					<option value="60%">Medium</option>
					<option value="75%">Wide</option>
					<option value="90%">Very Wide</option>
				</select>
			</div>
			<div className="setting-item">
				<label>Paragraph Spacing</label>
				<select
					value={settings.paragraphSpacing}
					onChange={(e) => setSettings({ ...settings, paragraphSpacing: e.target.value })}
				>
					<option value="0.5em">Tight</option>
					<option value="1em">Normal</option>
					<option value="1.5em">Relaxed</option>
				</select>
			</div>
			<div className="setting-item">
				<label>Pin Sidebar</label>
				<input
					type="checkbox"
					checked={settings.sidebarPinned}
					onChange={(e) => setSettings({ ...settings, sidebarPinned: e.target.checked })}
				/>
			</div>
			<div className="setting-item">
				<label>Enable Drop Caps</label>
				<input
					type="checkbox"
					checked={settings.enableDropCaps}
					onChange={(e) => setSettings({ ...settings, enableDropCaps: e.target.checked })}
				/>
			</div>
			{settings.enableDropCaps && (
				<>
					<div className="setting-item">
						<label>Drop Cap Size</label>
						<select
							value={settings.dropCapSize}
							onChange={(e) => setSettings({ ...settings, dropCapSize: e.target.value })}
						>
							<option value="2.5em">Small</option>
							<option value="3.5em">Medium</option>
							<option value="4.5em">Large</option>
						</select>
					</div>
					<div className="setting-item">
						<label>Drop Cap Line Height</label>
						<select
							value={settings.dropCapLineHeight}
							onChange={(e) => setSettings({ ...settings, dropCapLineHeight: e.target.value })}
						>
							<option value="2.5">Compact</option>
							<option value="3.5">Normal</option>
							<option value="4.5">Spacious</option>
						</select>
					</div>
				</>
			)}
		</div>
	);
};