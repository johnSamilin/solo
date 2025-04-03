import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from 'webdav';
import { logger } from '../logger';

// Use the app-specific directory instead of document directory
const STORAGE_DIR = FileSystem.documentDirectory + 'solo/';

const storeData = async (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    await logger.info(`Data stored successfully for key: ${key}`);
  } catch (error) {
    await logger.error(`Failed to store data for key: ${key}`, error);
    alert('Cannot save data: ' + error);
  }
};

const getData = async (key: string) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      await logger.info(`Data retrieved successfully for key: ${key}`);
      return value;
    }
    return "";
  } catch (error) {
    await logger.error(`Failed to retrieve data for key: ${key}`, error);
    alert('Cannot load data: ' + error);
    return "";
  }
};

export default function Index() {
  const [webAppContent, setWebAppContent] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    async function loadWebApp() {
      const injectBridge = `
      const listeners = new Map();
      window.addEventListener('bridge-response', (e) => {
        const callbacks = listeners.get(e.detail.messageType) ?? [];
        for (const c of callbacks) {
          c(e.detail);
        }
        listeners.set(e.detail.messageType, []);
      });

      function addListener(messageType, callback) {
        if (!listeners.has(messageType)) {
          listeners.set(messageType, []);
        }
        listeners.set(messageType, [...listeners.get(messageType), callback]);
      }

      window.bridge = {
        async loadFromStorage(key) {
          return new Promise(async (resolve, reject) => {
            try {
              const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'loadFromStorage',
                key
              }));
              addListener('loadFromStorage', (detail) => {
                if (detail.key === key) {
                  resolve(detail.data);
                }
              });
            } catch (error) {
              alert('Load from storage error: ' + error);
            }
          });
        },

        async saveToStorage(key, data) {
          return new Promise(async (resolve, reject) => {
            try {
              await window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'saveToStorage',
                key,
                data
              }));
              addListener('saveToStorage', (detail) => {
                if (detail.key === key) {
                  resolve(detail.data);
                }
              });
            } catch (error) {
              alert('Save to storage error: ' + error);
            }
          });
        },

        async pickExportFolder() {
          try {
            const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pickExportFolder'
            }));
            return response;
          } catch (error) {
            logger.error('Pick export folder error:', error);
            return '';
          }
        },

        async pickImportFolder() {
          try {
            const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'pickImportFolder'
            }));
            return response;
          } catch (error) {
            logger.error('Pick import folder error:', error);
            return '';
          }
        },

        async exportData(data, exportPath) {
          try {
            await window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'exportData',
              data,
              exportPath
            }));
          } catch (error) {
            logger.error('Export data error:', error);
          }
        },

        async openExternal(url) {
          try {
            await window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'openExternal',
              url
            }));
          } catch (error) {
            logger.error('Open external error:', error);
          }
        },

        testWebDAV(settingsJson) {
          return new Promise(async (resolve, reject) => {
            try {
              const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'testWebDAV',
                settingsJson
              }));
              addListener('testWebDAV', (detail) => {
                  resolve(detail.data);
              });
            } catch (error) {
              logger.error('Test WebDAV error:', error);
              return false;
            }
          });
        },

        async syncWebDAV(settingsJson) {
          return new Promise(async (resolve, reject) => {
            try {
              const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'syncWebDAV',
                settingsJson
              }));
              addListener('syncWebDAV', (detail) => {
                  resolve(detail.data);
              });
            } catch (error) {
              logger.error('Sync WebDAV error:', error);
              return false;
            }
          });
        },

        async restoreWebDAV(settingsJson) {
          return new Promise(async (resolve, reject) => {
            try {
              const response = await window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'restoreWebDAV',
                settingsJson
              }));
              addListener('restoreWebDAV', (detail) => {
                  resolve(detail.data);
              });
            } catch (error) {
              logger.error('Restore WebDAV error:', error);
              return false;
            }
          });
        }
      };
    `;

      try {
        const htmlAsset = Asset.fromModule(require('../assets/webapp/index.html'));
        await htmlAsset.downloadAsync();
        
        if (htmlAsset.localUri) {
          let content = await FileSystem.readAsStringAsync(htmlAsset.localUri);
          content = content.replace('<head>', `<head><script type='text/javascript'>${injectBridge}</script>`);
          setWebAppContent(content);
        }
      } catch (error) {
        await logger.error('Failed to load web app', error);
        setWebAppContent('https://comforting-starlight-b74676.netlify.app');
      }
    }

    loadWebApp();
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const { type, key, data, url, exportPath, settingsJson } = JSON.parse(event.nativeEvent.data);
      await logger.info(`Handling message of type: ${type}`);

      switch (type) {
        case 'loadFromStorage': {
          try {
            const data = await getData(key);
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'loadFromStorage',
                    data: ${data},
                    key: '${key}',
                  }
                }));
              `);
          } catch (error) {
            alert('Load from storage error: ' + error);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'loadFromStorage',
                  data: null,
                  key: '${key}'
                }
              }));
            `);
          }
          break;
        }

        case 'saveToStorage': {
          try {
            storeData(key, data);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'saveToStorage',
                  data: true,
                }
              }));
            `);
          } catch (error) {
            logger.error('Save to storage error:', error);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'saveToStorage',
                  data: false
                }
              }));
            `);
          }
          break;
        }

        case 'pickExportFolder': {
          if (await Sharing.isAvailableAsync()) {
            const exportDir = `${STORAGE_DIR}export`;
            const dirInfo = await FileSystem.getInfoAsync(exportDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
            }
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'pickExportFolder',
                  data: "${exportDir}"
                }
              }));
            `);
          }
          break;
        }

        case 'pickImportFolder': {
          break;
        }

        case 'exportData': {
          try {
            const exportDir = `${STORAGE_DIR}export`;
            const dirInfo = await FileSystem.getInfoAsync(exportDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
            }
            const filePath = `${exportDir}/solo-export-${new Date().toISOString().split('T')[0]}.json`;
            await FileSystem.writeAsStringAsync(filePath, data);
            await Sharing.shareAsync(filePath);
          } catch (error) {
            logger.error('Export data error:', error);
          }
          break;
        }

        case 'openExternal': {
          await WebBrowser.openBrowserAsync(url);
          break;
        }

        case 'testWebDAV': {
          try {
            const settings = JSON.parse(settingsJson);
            if (!settings?.url || !settings?.username || !settings?.password) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'testWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            const client = createClient(settings.url, {
              username: settings.username,
              password: settings.password,
              maxBodyLength: Infinity,
              maxContentLength: Infinity
            });
            
            // Test both read and write permissions
            const exists = await client.exists('/');
            if (!exists) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'testWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            // Try to create and remove a test directory
            const testDir = `/test-${Date.now()}`;
            await client.createDirectory(testDir);
            await client.deleteFile(testDir);

            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                    messageType: 'testWebDAV',
                    data: true
                  }
              }));
            `);
          } catch (error) {
            logger.error('WebDAV test failed:', error);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'testWebDAV',
                  data: false
                }
              }));
            `);
          }
          break;
        }

        case 'syncWebDAV': {
          try {
            const settings = JSON.parse(settingsJson);
            if (!settings.enabled) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'syncWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            const client = createClient(settings.url, {
              username: settings.username,
              password: settings.password,
              maxBodyLength: Infinity,
              maxContentLength: Infinity
            });

            // Ensure the Solo directory exists
            const soloDir = '/Solo';
            if (!await client.exists(soloDir)) {
              await client.createDirectory(soloDir);
            }

            // Upload current data
            const filename = `solo-backup-${new Date().toISOString().split('T')[0]}.json`;
            await client.putFileContents(`${soloDir}/${filename}`, await getData('solo-notes-data') ?? "");

            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'syncWebDAV',
                  data: true
                }
              }));
            `);
          } catch (error) {
            logger.error('WebDAV sync failed:', error);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'syncWebDAV',
                  data: false
                }
              }));
            `);
          }
          break;
        }

        case 'restoreWebDAV': {
          try {
            const settings = JSON.parse(settingsJson);
            if (!settings.enabled) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'restoreWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            const client = createClient(settings.url, {
              username: settings.username,
              password: settings.password,
              maxBodyLength: Infinity,
              maxContentLength: Infinity
            });

            // Get list of backups
            const soloDir = 'Solo';
            if (!await client.exists(soloDir)) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'restoreWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            const files = await client.getDirectoryContents(soloDir);
            const backupFiles = files
              .filter(file => file.basename.endsWith('.json'))
              .sort((a, b) => new Date(b.lastmod).getTime() - new Date(a.lastmod).getTime());

            if (backupFiles.length === 0) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'restoreWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            // Get the latest backup
            const latestBackup = backupFiles[0];
            const backupContent = await client.getFileContents(latestBackup.filename, { format: 'text' });
            
            // Parse and validate backup data
            let backupData = JSON.parse(backupContent.toString());
            if (typeof backupData === 'string') {
              // inconsistent file formats between desktop & android
              backupData = JSON.parse(backupData);
            }
            logger.info(typeof backupData)
            if (!backupData.notes || !backupData.notebooks) {
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('bridge-response', {
                  detail: {
                    messageType: 'restoreWebDAV',
                    data: false
                  }
                }));
              `);
              return;
            }

            // Store the backup data
            await storeData('solo-notes-data', JSON.stringify(backupData));
            
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'restoreWebDAV',
                  data: true
                }
              }));
            `);
          } catch (error) {
            logger.error('WebDAV restore failed:', error);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('bridge-response', {
                detail: {
                  messageType: 'restoreWebDAV',
                  data: false
                }
              }));
            `);
          }
          break;
        }
      }
    } catch (error) {
      await logger.error('Message handler error', error);
    }
  };

  if (!webAppContent) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView 
        ref={webViewRef}
        source={{ html: webAppContent }}
        style={styles.webview}
        allowsFullscreenVideo={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        onMessage={handleMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});