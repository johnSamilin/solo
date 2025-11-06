Create a native Ubuntu app with .deb installer. 

Visual style should be the same as in https://github.com/johnSamilin/solo web version (overall and typography/layout).

It should have settings section where I could pick a folder to store data. Folders in this root folder should be treated as notebooks, .md files are notes. On start, the app should scan this folder and render hierarchical list of notebooks and notes in sidebar (placed on the right). Each note should be accompanied by <title>.json file which should contain metadata: creation date, tags, selected theme.

Typewriter-based themes should play typing sound on keypress.

When I select a note, it's content should be displayed in main section, as well as editable title, date of creation and tags. I should be able to select a theme for particular note. Special markdown characters should not be visible, I'd like to be focused on text.