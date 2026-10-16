/**
 * Название под иконкой на рабочем столе — «Эмпин PRO».
 *
 * expo.name не меняем: из него собирается имя Xcode-проекта и исполняемого файла
 * (кириллица и пробел переименовали бы цель сборки и могли сломать подпись iOS).
 * Меняем только видимое имя: CFBundleDisplayName на iOS и app_name на Android.
 */
const { withInfoPlist, withStringsXml, AndroidConfig } = require('@expo/config-plugins');

module.exports = (config, { displayName }) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleDisplayName = displayName;
    return cfg;
  });

  config = withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: displayName })],
      cfg.modResults
    );
    return cfg;
  });

  return config;
};
