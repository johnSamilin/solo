import { FC, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Note, SavedFilter, SavedSearchExportProfile } from '../../../types';
import { useStore } from '../../../stores/StoreProvider';
import { getNativeAPI } from '../../../utils/nativeBridge';
import { createExportFileRequest } from './exportNotes';
import '../../Modals/Modals.css';
import './ExportSettingsModal.css';

type ExportSettingsModalProps = {
  filter: SavedFilter;
  notes: Note[];
  onClose: () => void;
};

const defaultProfile = (filter: SavedFilter): SavedSearchExportProfile => ({
  format: 'pdf',
  autoExport: false,
  title: filter.label,
  author: '',
  includeTableOfContents: true,
  cover: { enabled: true, title: filter.label, author: '' },
  headerFooter: { enabled: true, header: '{title}', footer: '', pageNumberPosition: 'bottom-center' },
  pageSize: 'A4',
});

export const ExportSettingsModal: FC<ExportSettingsModalProps> = ({ filter, notes, onClose }) => {
  const { savedFiltersStore } = useStore();
  const [profile, setProfile] = useState(() => {
    const defaults = defaultProfile(filter);
    if (!filter.exportProfile) return defaults;

    return {
      ...defaults,
      ...filter.exportProfile,
      cover: { ...defaults.cover, ...filter.exportProfile.cover },
      headerFooter: { ...defaults.headerFooter, ...filter.exportProfile.headerFooter },
    };
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>();

  const update = <K extends keyof SavedSearchExportProfile>(key: K, value: SavedSearchExportProfile[K]) => setProfile(current => ({ ...current, [key]: value }));
  const selectCoverImage = async () => {
    const result = await getNativeAPI()?.selectExportCoverImage();
    if (!result?.success || !result.data || !result.mediaType) {
      if (result?.error) setError(result.error);
      return;
    }
    update('cover', { ...profile.cover, imageData: result.data, imageMediaType: result.mediaType });
  };
  const exportNow = async () => {
    setIsExporting(true);
    setError(undefined);
    const api = getNativeAPI();
    if (!api) { setError('Экспорт доступен только в desktop-версии Solo'); setIsExporting(false); return; }
    const result = await api.exportFile(await createExportFileRequest(profile, filter, notes));
    setIsExporting(false);
    if (!result.success) { setError(result.error || 'Не удалось экспортировать заметки'); return; }
    savedFiltersStore.updateExportProfile(filter.id, { ...profile, outputPath: result.outputPath });
    onClose();
  };

  return <div className="modal-overlay" onClick={onClose}><div className="modal export-settings-modal" onClick={event => event.stopPropagation()}>
    <div className="modal-header"><h2>Экспорт: {filter.label}</h2><button className="button-icon" onClick={onClose}><X /></button></div>
    <div className="modal-content">
      <label className="export-settings-field">Формат<select value={profile.format} onChange={event => update('format', event.target.value as 'pdf' | 'epub')}><option value="pdf">PDF</option><option value="epub">EPUB</option></select></label>
      <label className="export-settings-field">Название<input type="text" value={profile.title} onChange={event => update('title', event.target.value)} /></label>
      <label className="export-settings-field">Автор<input type="text" value={profile.author} onChange={event => update('author', event.target.value)} /></label>
      <div className="export-settings-options"><label><input type="checkbox" checked={profile.includeTableOfContents} onChange={event => update('includeTableOfContents', event.target.checked)} /> Содержание</label><label><input type="checkbox" checked={profile.cover.enabled} onChange={event => update('cover', { ...profile.cover, enabled: event.target.checked })} /> Титульная страница</label>{profile.cover.enabled && <div className="export-cover-controls"><button type="button" className="button-secondary" onClick={selectCoverImage}>Выбрать изображение</button>{profile.cover.imageData && <button type="button" className="button-secondary" onClick={() => update('cover', { ...profile.cover, imageData: undefined, imageMediaType: undefined })}>Удалить изображение</button>}</div>}<label><input type="checkbox" checked={profile.headerFooter.enabled} onChange={event => update('headerFooter', { ...profile.headerFooter, enabled: event.target.checked })} /> Номера страниц</label>{profile.headerFooter.enabled && <label className="export-settings-field">Расположение номера<select value={profile.headerFooter.pageNumberPosition} onChange={event => update('headerFooter', { ...profile.headerFooter, pageNumberPosition: event.target.value as SavedSearchExportProfile['headerFooter']['pageNumberPosition'] })}><option value="top-left">Сверху слева</option><option value="top-center">Сверху по центру</option><option value="top-right">Сверху справа</option><option value="bottom-left">Снизу слева</option><option value="bottom-center">Снизу по центру</option><option value="bottom-right">Снизу справа</option></select></label>}<label><input type="checkbox" checked={profile.autoExport} disabled={!profile.outputPath} onChange={event => update('autoExport', event.target.checked)} /> Автоэкспорт после закрытия заметки</label></div>
      <p className="export-settings-summary">{notes.length} заметок будет экспортировано.</p>{error && <p className="export-settings-error" role="alert">{error}</p>}
    </div>
    <div className="modal-actions"><button className="button-secondary" onClick={() => { savedFiltersStore.updateExportProfile(filter.id, profile); onClose(); }}>Сохранить</button><button className="button-primary" disabled={isExporting} onClick={exportNow}><Download size={16} />{isExporting ? 'Экспорт...' : 'Экспортировать'}</button></div>
  </div></div>;
};
