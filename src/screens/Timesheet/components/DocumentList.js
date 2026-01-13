import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Функция для извлечения расширения файла из имени или mimeType
const getFileExtension = (document) => {
  // Пытаемся извлечь расширение из имени файла
  if (document.name && document.name.includes('.')) {
    const ext = document.name.split('.').pop().trim().toUpperCase();
    if (ext && ext.length > 0 && ext.length <= 5) {
      return ext;
    }
  }

  // Пытаемся извлечь расширение из URI
  if (document.uri && document.uri.includes('.')) {
    // Убираем query параметры, если есть
    const uriWithoutQuery = document.uri.split('?')[0];
    const ext = uriWithoutQuery.split('.').pop().trim().toUpperCase();
    if (ext && ext.length > 0 && ext.length <= 5) {
      return ext;
    }
  }

  // Fallback на основе mimeType
  if (document.mimeType) {
    const mimeMap = {
      // Документы
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/rtf': 'RTF',
      'text/rtf': 'RTF',
      'application/vnd.oasis.opendocument.text': 'ODT',
      'application/vnd.apple.pages': 'PAGES',
      'application/x-iwork-pages-sffpages': 'PAGES',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
      'application/vnd.apple.numbers': 'NUMBERS',
      'application/x-iwork-numbers-sffnumbers': 'NUMBERS',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'application/vnd.oasis.opendocument.presentation': 'ODP',
      'application/vnd.apple.keynote': 'KEYNOTE',
      'application/x-iwork-keynote-sffkey': 'KEYNOTE',
      // Архивы
      'application/zip': 'ZIP',
      'application/x-rar-compressed': 'RAR',
      'application/x-7z-compressed': '7Z',
      // Текст
      'text/plain': 'TXT',
      'text/csv': 'CSV',
      // Аудио
      'audio/mpeg': 'MP3',
      'audio/mp3': 'MP3',
      'audio/wav': 'WAV',
      'audio/x-wav': 'WAV',
      'audio/ogg': 'OGG',
      'audio/aac': 'AAC',
      'audio/flac': 'FLAC',
      'audio/x-m4a': 'M4A',
    };
    return mimeMap[document.mimeType] || 'FILE';
  }

  return 'FILE';
};

// Функция для форматирования размера файла
const formatFileSize = (bytes) => {
  // Проверка на null/undefined/0/NaN
  if (!bytes || bytes === 0 || typeof bytes !== 'number' || isNaN(bytes)) {
    return ''; // Не показываем размер, если его нет
  }

  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
};

// Функция для извлечения имени файла из URI/path
const getFileName = (document) => {
  // Если есть name - используем его (с декодированием)
  if (document.name && typeof document.name === 'string' && document.name.trim() !== '') {
    try {
      return decodeURIComponent(document.name);
    } catch (error) {
      return document.name;
    }
  }

  // Если name отсутствует - пытаемся извлечь из uri или path
  const pathSource = document.uri || document.path || '';
  if (pathSource && typeof pathSource === 'string') {
    try {
      const pathWithoutQuery = pathSource.split('?')[0];
      const fileName = pathWithoutQuery.split('/').pop();
      if (fileName && fileName.trim() !== '') {
        try {
          return decodeURIComponent(fileName);
        } catch {
          return fileName;
        }
      }
    } catch (error) {
      console.error('Error extracting filename from path', { error: error.message, pathSource });
    }
  }

  // Fallback
  return 'Документ';
};

// Компонент для отображения одного документа
const DocumentItem = ({ document, onRemove, onDownload, index, showControls = true, onPress }) => {
  const extension = getFileExtension(document);
  const fileSize = formatFileSize(document.size);
  const fileName = getFileName(document);

  return (
    <View style={styles.documentItem}>
      <TouchableOpacity
        style={styles.documentContent}
        activeOpacity={0.7}
        onPress={() => onPress && onPress(index)}
        disabled={!onPress}
      >
        {/* Кружок с расширением файла */}
        <View style={styles.documentIcon}>
          <Text style={styles.documentExtension}>{extension}</Text>
        </View>

        {/* Информация о файле */}
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {fileName}
          </Text>
          {fileSize && <Text style={styles.documentSize}>{fileSize}</Text>}
        </View>
      </TouchableOpacity>

      {/* Кнопка скачивания */}
      {!showControls && onDownload && (
        <TouchableOpacity
          style={styles.documentDownloadButton}
          onPress={() => onDownload(document, index)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="download" size={20} color="#4A90E2" />
        </TouchableOpacity>
      )}

      {/* Кнопка удаления */}
      {showControls && onRemove && (
        <TouchableOpacity
          style={styles.documentRemoveButton}
          onPress={() => onRemove(index)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={20} color="#999999" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Основной компонент списка документов
export const DocumentList = ({ documents, onRemove, onDownload, showControls = true }) => {
  if (!documents || documents.length === 0) {
    return null;
  }

  return (
    <View style={styles.documentList}>
      {documents.map((document, index) => (
        <DocumentItem
          key={index}
          document={document}
          onRemove={onRemove}
          onDownload={onDownload}
          index={index}
          showControls={showControls}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  documentList: {
    marginTop: 8,
    width: '100%',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    width: '100%',
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentExtension: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  documentInfo: {
    flex: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  documentName: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 12,
    color: '#888888',
  },
  documentDownloadButton: {
    padding: 4,
    marginLeft: 8,
  },
  documentRemoveButton: {
    padding: 4,
    marginLeft: 8,
  },
});
