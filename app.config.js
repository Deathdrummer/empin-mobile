// Приём «Поделиться» на iOS — отдельное расширение со своим профилем подписи и App Group.
// Сборка включает его явно (IOS_SHARE_EXTENSION в eas.json), когда профили готовы; Android от этого не зависит
const withShareExtensionFlag = (plugin) => {
  if (!Array.isArray(plugin) || plugin[0] !== 'expo-share-intent' || process.env.IOS_SHARE_EXTENSION === 'true') {
    return plugin;
  }
  return [plugin[0], { ...plugin[1], disableIOS: true }];
};

module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).map(withShareExtensionFlag);

  if (process.env.IOS_WITHOUT_FIREBASE !== 'true') {
    return { ...config, plugins };
  }

  return {
    ...config,
    plugins: plugins
      .filter((plugin) => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        return name !== '@react-native-firebase/app'
          && name !== 'react-native-full-screen-notification-incoming-call';
      })
      .map((plugin) => {
        if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') {
          return plugin;
        }

        const options = { ...(plugin[1] ?? {}) };
        delete options.ios;
        return [plugin[0], options];
      }),
  };
};
