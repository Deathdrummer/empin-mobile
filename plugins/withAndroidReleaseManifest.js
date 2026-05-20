const { withAndroidManifest } = require('@expo/config-plugins');

const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const TOOLS_NS = 'http://schemas.android.com/tools';

const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
const READ_EXTERNAL_STORAGE = 'android.permission.READ_EXTERNAL_STORAGE';
const WRITE_EXTERNAL_STORAGE = 'android.permission.WRITE_EXTERNAL_STORAGE';
const MEDIA_PROJECTION_PERMISSION = 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION';
const PREVIEW_ACTIVITY = 'androidx.compose.ui.tooling.PreviewActivity';
const AGORA_SCREEN_CAPTURE_ACTIVITY = 'io.agora.rtc2.extensions.MediaProjectionMgr$LocalScreenCaptureAssistantActivity';
const AGORA_SCREEN_SHARING_SERVICE = 'io.agora.rtc2.extensions.MediaProjectionMgr$LocalScreenSharingService';

const getName = (item) => item?.$?.['android:name'];

const ensureNamespace = (manifest, key, value) => {
  manifest.$ = manifest.$ || {};
  if (!manifest.$[key]) {
    manifest.$[key] = value;
  }
};

const ensurePermission = (manifest, name) => {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const existing = manifest['uses-permission'].find((permission) => getName(permission) === name);

  if (existing) {
    return existing;
  }

  const permission = { $: { 'android:name': name } };
  manifest['uses-permission'].push(permission);
  return permission;
};

const setPermissionMaxSdk = (manifest, name, maxSdkVersion) => {
  const permission = ensurePermission(manifest, name);
  permission.$['android:maxSdkVersion'] = String(maxSdkVersion);
};

const removePermission = (manifest, name) => {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const existing = manifest['uses-permission'].find((permission) => getName(permission) === name);

  if (existing) {
    existing.$['tools:node'] = 'remove';
    return;
  }

  manifest['uses-permission'].push({
    $: {
      'android:name': name,
      'tools:node': 'remove',
    },
  });
};

const removeApplicationComponent = (application, componentType, name) => {
  application[componentType] = application[componentType] || [];

  const existing = application[componentType].find((component) => getName(component) === name);
  if (existing) {
    existing.$['tools:node'] = 'remove';
    return;
  }

  application[componentType].push({
    $: {
      'android:name': name,
      'tools:node': 'remove',
    },
  });
};

const removePreviewActivity = (application) => {
  removeApplicationComponent(application, 'activity', PREVIEW_ACTIVITY);
};

const removeAgoraScreenSharing = (application) => {
  removeApplicationComponent(application, 'activity', AGORA_SCREEN_CAPTURE_ACTIVITY);
  removeApplicationComponent(application, 'service', AGORA_SCREEN_SHARING_SERVICE);
};

module.exports = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    ensureNamespace(manifest, 'xmlns:android', ANDROID_NS);
    ensureNamespace(manifest, 'xmlns:tools', TOOLS_NS);

    ensurePermission(manifest, POST_NOTIFICATIONS);
    setPermissionMaxSdk(manifest, WRITE_EXTERNAL_STORAGE, 28);
    setPermissionMaxSdk(manifest, READ_EXTERNAL_STORAGE, 32);
    removePermission(manifest, MEDIA_PROJECTION_PERMISSION);

    if (application) {
      removePreviewActivity(application);
      removeAgoraScreenSharing(application);
    }

    return config;
  });
};
