Pod::Spec.new do |s|
  s.name           = 'EmpinNotificationActions'
  s.version        = '1.0.0'
  s.summary        = 'Keeps EMPIN awake while a notification reply is being sent.'
  s.description    = 'Holds a background task from the "Reply" / "Read" notification action until JavaScript has handled it.'
  s.license        = { :type => 'MIT' }
  s.author         = 'EMPIN'
  s.homepage       = 'https://github.com/Deathdrummer/empin-mobile'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/Deathdrummer/empin-mobile.git' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.dependency 'EXNotifications'
  s.frameworks = 'UserNotifications'
  s.source_files = '**/*.{h,m,mm,swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
