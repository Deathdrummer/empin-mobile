Pod::Spec.new do |s|
  s.name           = 'EmpinVoip'
  s.version        = '1.0.0'
  s.summary        = 'Native PushKit and CallKit integration for EMPIN.'
  s.description    = 'Receives APNs VoIP pushes and reports incoming calls to CallKit before React Native starts.'
  s.license        = { :type => 'MIT' }
  s.author         = 'EMPIN'
  s.homepage       = 'https://github.com/Deathdrummer/empin-mobile'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/Deathdrummer/empin-mobile.git' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PushKit', 'CallKit', 'AVFoundation'
  s.source_files = '**/*.{h,m,mm,swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
