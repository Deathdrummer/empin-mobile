module.exports = ({ config }) => {
  if (process.env.IOS_WITHOUT_FIREBASE !== 'true') {
    return config;
  }

  const plugins = (config.plugins ?? [])
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
    });

  return {
    ...config,
    plugins,
  };
};
