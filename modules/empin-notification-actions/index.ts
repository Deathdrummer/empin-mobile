import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

declare class EmpinNotificationActionsNativeModule extends NativeModule {
  /** Нажатие «Ответить» / «Прочитано» обработано — iOS может снова усыплять приложение */
  finish(key: string): void;
}

// Только iOS: на Android нажатия обрабатывает фоновая задача expo-task-manager
export default requireOptionalNativeModule<EmpinNotificationActionsNativeModule>('EmpinNotificationActions');
