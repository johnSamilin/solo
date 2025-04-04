# Development Prompts History

This file contains all the prompts and feature requests made during the development of Solo.

## Initial Setup

1. **Project Initialization**
   ```
   Create a new Electron app with Vite and React
   ```

2. **Basic Features Setup**
   ```
   Add basic features:
   - Create notes
   - Edit notes
   - Delete notes
   - Organize notes in notebooks
   ```

3. **Typography and Styling**
   ```
   Add typography settings:
   - Font family selection
   - Font size options
   - Line height adjustment
   ```

4. **Zen Mode**
   ```
   Add a zen mode that:
   - Hides the sidebar
   - Goes fullscreen
   - Focuses on content
   ```

5. **Tags System**
   ```
   Add a tagging system with:
   - Hierarchical tags (using /)
   - Tag management modal
   - Tag display on notes
   ```

## Feature Enhancements

1. **Add Note Settings Modal**
   ```
   Add a button to FAB that opens Note Settings modal. In this modal, there should be:
   - Move to another notebook
   - Delete note button (styled in red)
   ```

2. **Add Censorship System**
   ```
   Add a tab to settings modal named "Censorship". There should be a button that sets up a pin code. When this pin code is set, there should also be a button that turns censorship off (it is on by default)
   ```

3. **Enhance Censorship Security**
   ```
   When I enter incorrect pin for censorship mode, it should not display error. Instead, it should fake that censorship is off
   ```

4. **Modify Censorship Behavior**
   ```
   turning censorship on should not require pin code. Also, Ctrl+Shift+. should immediately turn censorship on
   ```

5. **Censorship Text Handling**
   ```
   When censorship mode is on, notes should not contain text that is marked as censored
   ```

6. **Censorship Text Removal**
   ```
   Censored text should be completely cut off from note when censorship is on
   ```

7. **Censorship PIN Security**
   ```
   When I enter wrong pin code for censorship mode, censored text should remain cut off
   ```

8. **Note-level Censorship**
   ```
   Add possibility to mark whole notes as censored and let them behave just like censored text in regular notes (completely hidden when censorship is on)
   ```

9. **Editor Whitespace Fix**
   ```
   I can't add space after the last word in note, fix it
   ```

10. **Prompts History**
    ```
    From now on, keep prompts history in PROMPTS.md
    ```

11. **Font Inlining**
    ```
    when building webapp in plugin mode, inline local fonts
    ```

12. **Add Logging System**
    ```
    for electron and mobile app, store errors and logs in a file (max size 5MB, rotate)
    ```

13. **Add Notebook-level Censorship**
    ```
    Add possibility to mark whole notebooks censored
    ```

14. **Add Notebook Context Menu**
    ```
    Add context menu to notebookItem component. It should contain "Edit" button, which opens notebook edit modal. Move notebook-level censorship setting there
    ```