import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

declare class EmpinCallServiceNativeModule extends NativeModule<Record<string, never>> {
  /** Запускает службу переднего плана на время звонка. false — запуск невозможен (нет разрешения, приложение в фоне). */
  start(title: string): boolean;
  stop(): void;
}

// Только Android: на iOS фоновый звук держат CallKit и фоновые режимы audio/voip
export default requireOptionalNativeModule<EmpinCallServiceNativeModule>('EmpinCallService');
