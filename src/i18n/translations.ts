export type Locale = 'en' | 'ru';

export interface Translations {
  sidebar: {
    allNotes: string;
    notebooks: string;
    tags: string;
    settings: string;
    newNotebook: string;
    newNote: string;
    search: string;
    askQuestion: string;
  };
  editor: {
    untitled: string;
    clickToEditDate: string;
    toggleToolbar: string;
    previousNote: string;
    nextNote: string;
    createNewNote: string;
    jumpToMonth: string;
    annotation: string;
    noteTitle: string;
  };
  notebooks: {
    newNotebook: string;
    editNotebook: string;
    enterName: string;
    create: string;
    update: string;
    cancel: string;
    delete: string;
    confirmDelete: string;
  };
  tags: {
    addTags: string;
    searchTags: string;
    renameTag: string;
    deleteTag: string;
    tagRenamed: string;
    tagDeleted: string;
    failedToRename: string;
    failedToDelete: string;
    confirmDelete: string;
    confirmDeleteMessage: string;
    index: string;
    noTags: string;
    addNewTag: string;
  };
  settings: {
    settings: string;
    layout: string;
    typography: string;
    tags: string;
    statistics: string;
    layoutStandard: string;
    layoutAnnotated: string;
    font: string;
    fontSize: string;
    lineHeight: string;
    typewriterMode: string;
    typewriterSound: string;
    zenMode: string;
    showToolbar: string;
    showNotebookName: string;
    showTags: string;
    showWordCount: string;
    enableSpeech: string;
    language: string;
    tagManagement: string;
    manageTags: string;
    pageMargins: string;
    maxWidth: string;
    paragraphSpacing: string;
    pinSidebar: string;
    autoZenMode: string;
    enableDropCaps: string;
    dropCapSize: string;
    dropCapLineHeight: string;
    narrow: string;
    medium: string;
    wide: string;
    veryWide: string;
    tight: string;
    normal: string;
    relaxed: string;
    small: string;
    large: string;
    compact: string;
    spacious: string;
  };
  statistics: {
    statistics: string;
    notebooks: string;
    notes: string;
    totalWords: string;
    emptyNotes: string;
  };
  search: {
    search: string;
    searchNotes: string;
    filters: string;
    allNotebooks: string;
    allTags: string;
    results: string;
    noResults: string;
    searchPlaceholder: string;
  };
  timeline: {
    timeline: string;
    today: string;
    yesterday: string;
    thisWeek: string;
    thisMonth: string;
    older: string;
  };
  noteSettings: {
    noteSettings: string;
    notebook: string;
    created: string;
    updated: string;
    wordCount: string;
    close: string;
  };
  readingMode: {
    readingMode: string;
    exitReading: string;
  };
  imageModal: {
    insertImage: string;
    imageUrl: string;
    altText: string;
    insert: string;
    cancel: string;
    toggleFullWidth: string;
    recognizeText: string;
    deleteImage: string;
  };
  textRecognition: {
    textRecognition: string;
    selectImage: string;
    recognizing: string;
    insert: string;
    cancel: string;
  };
  common: {
    close: string;
    menu: string;
    save: string;
    delete: string;
    cancel: string;
    confirm: string;
    yes: string;
    no: string;
  };
}

export const translations: Record<Locale, Translations> = {
  en: {
    sidebar: {
      allNotes: 'All Notes',
      notebooks: 'Notebooks',
      tags: 'Tags',
      settings: 'Settings',
      newNotebook: 'New Notebook',
      newNote: 'New Note',
      search: 'Search',
      askQuestion: 'Ask a question',
    },
    editor: {
      untitled: 'Untitled',
      clickToEditDate: 'Click to edit date',
      toggleToolbar: 'Toggle toolbar',
      previousNote: 'Previous note',
      nextNote: 'Next note',
      createNewNote: 'Create new note',
      jumpToMonth: 'Jump to month',
      annotation: 'Annotation',
      noteTitle: 'Note Title',
    },
    notebooks: {
      newNotebook: 'New Notebook',
      editNotebook: 'Edit Notebook',
      enterName: 'Enter notebook name',
      create: 'Create',
      update: 'Update',
      cancel: 'Cancel',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this notebook?',
    },
    tags: {
      addTags: 'Add tags...',
      searchTags: 'Search tags...',
      renameTag: 'Rename tag',
      deleteTag: 'Delete tag',
      tagRenamed: 'Tag renamed successfully',
      tagDeleted: 'Tag deleted successfully',
      failedToRename: 'Failed to rename tag',
      failedToDelete: 'Failed to delete tag',
      confirmDelete: 'Are you sure you want to delete the tag',
      confirmDeleteMessage: 'This will remove it from all notes.',
      index: 'Index',
      noTags: 'No tags found',
      addNewTag: 'Add new tag (e.g., work/projects/active)',
    },
    settings: {
      settings: 'Settings',
      layout: 'Layout',
      typography: 'Typography',
      tags: 'Tags',
      statistics: 'Statistics',
      layoutStandard: 'Standard',
      layoutAnnotated: 'Annotated',
      font: 'Font',
      fontSize: 'Font Size',
      lineHeight: 'Line Height',
      typewriterMode: 'Typewriter Mode',
      typewriterSound: 'Typewriter Sound',
      zenMode: 'Zen Mode',
      showToolbar: 'Show Toolbar',
      showNotebookName: 'Show Notebook Name',
      showTags: 'Show Tags',
      showWordCount: 'Show Word Count',
      enableSpeech: 'Enable Speech Recognition',
      language: 'Language',
      tagManagement: 'Tag Management',
      manageTags: 'Manage Tags',
      pageMargins: 'Page Margins',
      maxWidth: 'Maximum Width',
      paragraphSpacing: 'Paragraph Spacing',
      pinSidebar: 'Pin Sidebar',
      autoZenMode: 'Auto Zen Mode',
      enableDropCaps: 'Enable Drop Caps',
      dropCapSize: 'Drop Cap Size',
      dropCapLineHeight: 'Drop Cap Line Height',
      narrow: 'Narrow',
      medium: 'Medium',
      wide: 'Wide',
      veryWide: 'Very Wide',
      tight: 'Tight',
      normal: 'Normal',
      relaxed: 'Relaxed',
      small: 'Small',
      large: 'Large',
      compact: 'Compact',
      spacious: 'Spacious',
    },
    statistics: {
      statistics: 'Statistics',
      notebooks: 'Notebooks',
      notes: 'Notes',
      totalWords: 'Total Words',
      emptyNotes: 'Empty Notes',
    },
    search: {
      search: 'Search',
      searchNotes: 'Search notes...',
      filters: 'Filters',
      allNotebooks: 'All Notebooks',
      allTags: 'All Tags',
      results: 'Results',
      noResults: 'No results found',
      searchPlaceholder: 'Search notes... (fuzzy search supported)',
    },
    timeline: {
      timeline: 'Timeline',
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      older: 'Older',
    },
    noteSettings: {
      noteSettings: 'Note Settings',
      notebook: 'Notebook',
      created: 'Created',
      updated: 'Updated',
      wordCount: 'Word Count',
      close: 'Close',
    },
    readingMode: {
      readingMode: 'Reading Mode',
      exitReading: 'Exit Reading Mode',
    },
    imageModal: {
      insertImage: 'Insert Image',
      imageUrl: 'Image URL',
      altText: 'Alt Text',
      insert: 'Insert',
      cancel: 'Cancel',
      toggleFullWidth: 'Toggle Full Width',
      recognizeText: 'Recognize Text',
      deleteImage: 'Delete Image',
    },
    textRecognition: {
      textRecognition: 'Text Recognition',
      selectImage: 'Select an image',
      recognizing: 'Recognizing...',
      insert: 'Insert',
      cancel: 'Cancel',
    },
    common: {
      close: 'Close',
      menu: 'Menu',
      save: 'Save',
      delete: 'Delete',
      cancel: 'Cancel',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
    },
  },
  ru: {
    sidebar: {
      allNotes: 'Все заметки',
      notebooks: 'Блокноты',
      tags: 'Теги',
      settings: 'Настройки',
      newNotebook: 'Новый блокнот',
      newNote: 'Новая заметка',
      search: 'Поиск',
      askQuestion: 'Задать вопрос',
    },
    editor: {
      untitled: 'Без названия',
      clickToEditDate: 'Нажмите, чтобы изменить дату',
      toggleToolbar: 'Переключить панель инструментов',
      previousNote: 'Предыдущая заметка',
      nextNote: 'Следующая заметка',
      createNewNote: 'Создать новую заметку',
      jumpToMonth: 'Перейти к месяцу',
      annotation: 'Аннотация',
      noteTitle: 'Название заметки',
    },
    notebooks: {
      newNotebook: 'Новый блокнот',
      editNotebook: 'Редактировать блокнот',
      enterName: 'Введите название блокнота',
      create: 'Создать',
      update: 'Обновить',
      cancel: 'Отмена',
      delete: 'Удалить',
      confirmDelete: 'Вы уверены, что хотите удалить этот блокнот?',
    },
    tags: {
      addTags: 'Добавить теги...',
      searchTags: 'Поиск тегов...',
      renameTag: 'Переименовать тег',
      deleteTag: 'Удалить тег',
      tagRenamed: 'Тег успешно переименован',
      tagDeleted: 'Тег успешно удалён',
      failedToRename: 'Не удалось переименовать тег',
      failedToDelete: 'Не удалось удалить тег',
      confirmDelete: 'Вы уверены, что хотите удалить тег',
      confirmDeleteMessage: 'Это удалит его из всех заметок.',
      index: 'Индекс',
      noTags: 'Теги не найдены',
      addNewTag: 'Добавить новый тег (например, работа/проекты/активные)',
    },
    settings: {
      settings: 'Настройки',
      layout: 'Макет',
      typography: 'Типографика',
      tags: 'Теги',
      statistics: 'Статистика',
      layoutStandard: 'Стандартный',
      layoutAnnotated: 'С аннотациями',
      font: 'Шрифт',
      fontSize: 'Размер шрифта',
      lineHeight: 'Высота строки',
      typewriterMode: 'Режим пишущей машинки',
      typewriterSound: 'Звук пишущей машинки',
      zenMode: 'Режим дзен',
      showToolbar: 'Показать панель инструментов',
      showNotebookName: 'Показать название блокнота',
      showTags: 'Показать теги',
      showWordCount: 'Показать количество слов',
      enableSpeech: 'Включить распознавание речи',
      language: 'Язык',
      tagManagement: 'Управление тегами',
      manageTags: 'Управление тегами',
      pageMargins: 'Поля страницы',
      maxWidth: 'Максимальная ширина',
      paragraphSpacing: 'Интервал между абзацами',
      pinSidebar: 'Закрепить боковую панель',
      autoZenMode: 'Автоматический режим дзен',
      enableDropCaps: 'Включить буквицы',
      dropCapSize: 'Размер буквицы',
      dropCapLineHeight: 'Высота строки буквицы',
      narrow: 'Узкие',
      medium: 'Средние',
      wide: 'Широкие',
      veryWide: 'Очень широкие',
      tight: 'Плотный',
      normal: 'Обычный',
      relaxed: 'Свободный',
      small: 'Маленький',
      large: 'Большой',
      compact: 'Компактная',
      spacious: 'Просторная',
    },
    statistics: {
      statistics: 'Статистика',
      notebooks: 'Блокноты',
      notes: 'Заметки',
      totalWords: 'Всего слов',
      emptyNotes: 'Пустые заметки',
    },
    search: {
      search: 'Поиск',
      searchNotes: 'Поиск заметок...',
      filters: 'Фильтры',
      allNotebooks: 'Все блокноты',
      allTags: 'Все теги',
      results: 'Результаты',
      noResults: 'Ничего не найдено',
      searchPlaceholder: 'Поиск заметок... (поддерживается нечёткий поиск)',
    },
    timeline: {
      timeline: 'Хронология',
      today: 'Сегодня',
      yesterday: 'Вчера',
      thisWeek: 'На этой неделе',
      thisMonth: 'В этом месяце',
      older: 'Ранее',
    },
    noteSettings: {
      noteSettings: 'Настройки заметки',
      notebook: 'Блокнот',
      created: 'Создано',
      updated: 'Обновлено',
      wordCount: 'Количество слов',
      close: 'Закрыть',
    },
    readingMode: {
      readingMode: 'Режим чтения',
      exitReading: 'Выйти из режима чтения',
    },
    imageModal: {
      insertImage: 'Вставить изображение',
      imageUrl: 'URL изображения',
      altText: 'Альтернативный текст',
      insert: 'Вставить',
      cancel: 'Отмена',
      toggleFullWidth: 'Переключить на полную ширину',
      recognizeText: 'Распознать текст',
      deleteImage: 'Удалить изображение',
    },
    textRecognition: {
      textRecognition: 'Распознавание текста',
      selectImage: 'Выберите изображение',
      recognizing: 'Распознавание...',
      insert: 'Вставить',
      cancel: 'Отмена',
    },
    common: {
      close: 'Закрыть',
      menu: 'Меню',
      save: 'Сохранить',
      delete: 'Удалить',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
      yes: 'Да',
      no: 'Нет',
    },
  },
};

export function detectLocale(): Locale {
  const browserLocale = navigator.language || (navigator as any).userLanguage;
  const languageCode = browserLocale.split('-')[0];

  if (languageCode === 'ru') {
    return 'ru';
  }

  return 'en';
}
