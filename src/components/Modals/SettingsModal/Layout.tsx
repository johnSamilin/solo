import { FC } from "react";
import { TypographySettings } from "../../../types";
import { useI18n } from "../../../i18n/I18nContext";
import type { Locale } from "../../../i18n/translations";

type LayoutProps = {
	settings: TypographySettings;
	setSettings: (newSettings: Partial<TypographySettings>) => void;
};

export const Layout: FC<LayoutProps> = ({ settings, setSettings }) => {
	const { t, locale, setLocale } = useI18n();

	return (
		<div className="settings-group">
			<h3>{t.settings.layout}</h3>
			<div className="setting-item">
				<label>{t.settings.language}</label>
				<select
					value={locale}
					onChange={(e) => setLocale(e.target.value as Locale)}
				>
					<option value="en">English</option>
					<option value="ru">Русский</option>
				</select>
			</div>
			<div className="setting-item">
				<label>{t.settings.pageMargins}</label>
				<select
					value={settings.pageMargins}
					onChange={(e) => setSettings({ ...settings, pageMargins: e.target.value })}
				>
					<option value="1rem">{t.settings.narrow}</option>
					<option value="2rem">{t.settings.medium}</option>
					<option value="3rem">{t.settings.wide}</option>
				</select>
			</div>
			<div className="setting-item">
				<label>{t.settings.maxWidth}</label>
				<select
					value={settings.maxEditorWidth}
					onChange={(e) => setSettings({ ...settings, maxEditorWidth: e.target.value })}
				>
					<option value="50%">{t.settings.narrow}</option>
					<option value="60%">{t.settings.medium}</option>
					<option value="75%">{t.settings.wide}</option>
					<option value="90%">{t.settings.veryWide}</option>
				</select>
			</div>
			<div className="setting-item">
				<label>{t.settings.paragraphSpacing}</label>
				<select
					value={settings.paragraphSpacing}
					onChange={(e) => setSettings({ ...settings, paragraphSpacing: e.target.value })}
				>
					<option value="0.5em">{t.settings.tight}</option>
					<option value="1em">{t.settings.normal}</option>
					<option value="1.5em">{t.settings.relaxed}</option>
				</select>
			</div>
			<div className="setting-item">
				<label>{t.settings.pinSidebar}</label>
				<input
					type="checkbox"
					checked={settings.sidebarPinned}
					onChange={(e) => setSettings({ ...settings, sidebarPinned: e.target.checked })}
				/>
			</div>
			<div className="setting-item">
				<label>{t.settings.autoZenMode}</label>
				<input
					type="checkbox"
					checked={settings.autoZenMode}
					onChange={(e) => setSettings({ ...settings, autoZenMode: e.target.checked })}
				/>
			</div>
			<div className="setting-item">
				<label>{t.settings.enableDropCaps}</label>
				<input
					type="checkbox"
					checked={settings.enableDropCaps}
					onChange={(e) => setSettings({ ...settings, enableDropCaps: e.target.checked })}
				/>
			</div>
			{settings.enableDropCaps && (
				<>
					<div className="setting-item">
						<label>{t.settings.dropCapSize}</label>
						<select
							value={settings.dropCapSize}
							onChange={(e) => setSettings({ ...settings, dropCapSize: e.target.value })}
						>
							<option value="2.5em">{t.settings.small}</option>
							<option value="3.5em">{t.settings.medium}</option>
							<option value="4.5em">{t.settings.large}</option>
						</select>
					</div>
					<div className="setting-item">
						<label>{t.settings.dropCapLineHeight}</label>
						<select
							value={settings.dropCapLineHeight}
							onChange={(e) => setSettings({ ...settings, dropCapLineHeight: e.target.value })}
						>
							<option value="2.5">{t.settings.compact}</option>
							<option value="3.5">{t.settings.normal}</option>
							<option value="4.5">{t.settings.spacious}</option>
						</select>
					</div>
				</>
			)}
		</div>
	);
};