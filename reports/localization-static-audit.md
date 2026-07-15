# GlukoTrack Localization Static Audit

Generated: 2026-07-15T13:07:03.591Z

## Scope

- Flutter app: Android, iOS, Web, Windows, macOS from shared Dart UI.
- Public website: `website_source` pages and JavaScript.
- Admin panel: `website_source/admin`.
- Backend-rendered UI: SOS public page, password reset, email/document/export generators.
- Native shells: Android resources/Kotlin, iOS storyboard/Swift, Windows/macOS runners.

## Summary

- Inventory rows: 43
- Files scanned: 212
- Locales detected: 30
- Translation keys union: 506
- Used keys detected in Flutter UI: 447
- Findings total: 8012
- High: 7724
- Medium: 288
- Low: 0
- Missing keys: 7720
- Hardcoded UI strings: 288
- Mojibake findings: 0

## Findings By Kind

- missing-translation-key: 7720
- hardcoded-ui-string: 288
- key-as-value: 4

## First 200 Findings

| ID | Severity | Kind | File | Line | Locale/Key | Value |
| --- | --- | --- | --- | ---: | --- | --- |
| KEY-1 | high | key-as-value | lib/l10n/app_localizations.dart | 2367 | de / kcal |  |
| KEY-2 | high | key-as-value | lib/l10n/app_localizations.dart | 3103 | de / kcal |  |
| KEY-3 | high | key-as-value | lib/l10n/app_localizations.dart | 3255 | fr / kcal |  |
| KEY-4 | high | key-as-value | lib/l10n/app_localizations.dart | 3404 | pl / kcal |  |
| HARD-5 | medium | hardcoded-ui-string | lib/models/app_state.dart | 205 |  | Duration.zero && remaining |
| HARD-6 | medium | hardcoded-ui-string | lib/models/app_state.dart | 318 |  | = 0 && diabetesTypeIndex |
| HARD-7 | medium | hardcoded-ui-string | lib/models/app_state.dart | 880 |  | applyServerSnapshot(Map |
| HARD-8 | medium | hardcoded-ui-string | lib/models/app_state.dart | 1090 |  | replaceSensorReadings(List |
| HARD-9 | medium | hardcoded-ui-string | lib/models/app_state.dart | 1248 |  | (List |
| HARD-10 | medium | hardcoded-ui-string | lib/navigation/app_navigator.dart | 6 |  | key = GlobalKey |
| HARD-11 | medium | hardcoded-ui-string | lib/navigation/app_navigator.dart | 43 |  | (Future |
| HARD-12 | medium | hardcoded-ui-string | lib/screens/auth_screen.dart | 139 |  | $provider: $message |
| HARD-13 | medium | hardcoded-ui-string | lib/screens/auth_screen.dart | 451 |  | (value?.length ?? 0) |
| HARD-14 | medium | hardcoded-ui-string | lib/screens/emergency_profile_screen.dart | 359 |  | $value |
| HARD-15 | medium | hardcoded-ui-string | lib/screens/export_screen.dart | 182 |  | GlukoTrack Doctor Report |
| HARD-16 | medium | hardcoded-ui-string | lib/screens/export_screen.dart | 193 |  | GlukoTrack Doctor Report |
| HARD-17 | medium | hardcoded-ui-string | lib/screens/export_screen.dart | 195 |  | This report is informational and does not replace medical care. |
| HARD-18 | medium | hardcoded-ui-string | lib/screens/export_screen.dart | 196 |  | Diary entries |
| HARD-19 | medium | hardcoded-ui-string | lib/screens/export_screen.dart | 199 |  | $rows |
| HARD-20 | medium | hardcoded-ui-string | lib/screens/subscription_screen.dart | 113 |  | _run(Future |
| HARD-21 | medium | hardcoded-ui-string | lib/screens/trends_screen.dart | 134 |  | = 3.9 && value |
| HARD-22 | medium | hardcoded-ui-string | lib/services/about_service.dart | 99 |  | AboutAdvantage.fromJson(Map |
| HARD-23 | medium | hardcoded-ui-string | lib/services/cloud_sync_service.dart | 50 |  | = 200 && response.statusCode |
| HARD-24 | medium | hardcoded-ui-string | lib/services/diary_analysis_service.dart | 52 |  | = 3.9 && value |
| HARD-25 | medium | hardcoded-ui-string | lib/services/food_recognition_service.dart | 104 |  | _decodeJson(List |
| HARD-26 | medium | hardcoded-ui-string | lib/widgets/responsive_two_column_list.dart | 38 |  | = 0 && index |
| HARD-27 | medium | hardcoded-ui-string | lib/widgets/responsive_two_column_list.dart | 44 |  | = 0 && index |
| HARD-28 | medium | hardcoded-ui-string | website_source/about/index.html | 6 |  | About GlukoTrack |
| HARD-29 | medium | hardcoded-ui-string | website_source/about/index.html | 17 |  | Web App |
| HARD-30 | medium | hardcoded-ui-string | website_source/about/index.html | 18 |  | Help Center |
| HARD-31 | medium | hardcoded-ui-string | website_source/about/index.html | 19 |  | About GlukoTrack |
| HARD-32 | medium | hardcoded-ui-string | website_source/about/index.html | 27 |  | About GlukoTrack |
| HARD-33 | medium | hardcoded-ui-string | website_source/about/index.html | 30 |  | Start using |
| HARD-34 | medium | hardcoded-ui-string | website_source/about/index.html | 31 |  | Explore features |
| HARD-35 | medium | hardcoded-ui-string | website_source/about/index.html | 32 |  | Download app |
| HARD-36 | medium | hardcoded-ui-string | website_source/about/index.html | 37 |  | What is GlukoTrack |
| HARD-37 | medium | hardcoded-ui-string | website_source/about/index.html | 42 |  | Main benefits |
| HARD-38 | medium | hardcoded-ui-string | website_source/about/index.html | 47 |  | Medical notice |
| HARD-39 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1130 |  | ` : ` |
| HARD-40 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1169 |  | `).join("") : ` |
| HARD-41 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1328 |  | `).join("") : ` |
| HARD-42 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1337 |  | `).join("") : ` |
| HARD-43 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1421 |  | `).join("") : ` |
| HARD-44 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1503 |  | `).join("") : ` |
| HARD-45 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1507 |  | `).join("") : ` |
| HARD-46 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1511 |  | `).join("") : ` |
| HARD-47 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1649 |  | ` : ` |
| HARD-48 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1376 |  | super_admin,support |
| HARD-49 | medium | hardcoded-ui-string | website_source/admin/admin.js | 1377 |  | medical:read,backups:write |
| HARD-50 | medium | hardcoded-ui-string | website_source/admin/index.html | 8 |  | GlucoTrack Admin |
| HARD-51 | medium | hardcoded-ui-string | website_source/admin/index.html | 18 |  | Admin panel |
| HARD-52 | medium | hardcoded-ui-string | website_source/admin/index.html | 56 |  | Secure admin access |
| HARD-53 | medium | hardcoded-ui-string | website_source/admin/index.html | 68 |  | 2FA code |
| HARD-54 | medium | hardcoded-ui-string | website_source/admin/index.html | 71 |  | Sign in |
| HARD-55 | medium | hardcoded-ui-string | website_source/admin/index.html | 13 |  | Admin navigation |
| HARD-56 | medium | hardcoded-ui-string | website_source/app/flutter_bootstrap.js | 1 |  | typeof Intl.v8BreakIterator |
| HARD-57 | medium | hardcoded-ui-string | website_source/help/help.js | 236 |  | `).join("") : ` |
| HARD-58 | medium | hardcoded-ui-string | website_source/help/index.html | 7 |  | GlukoTrack Help Center |
| HARD-59 | medium | hardcoded-ui-string | website_source/help/index.html | 15 |  | Web App |
| HARD-60 | medium | hardcoded-ui-string | website_source/help/index.html | 23 |  | Help Center |
| HARD-61 | medium | hardcoded-ui-string | website_source/help/index.html | 24 |  | Help Center |
| HARD-62 | medium | hardcoded-ui-string | website_source/help/index.html | 25 |  | Find answers about GlukoTrack |
| HARD-63 | medium | hardcoded-ui-string | website_source/help/index.html | 37 |  | Popular articles |
| HARD-64 | medium | hardcoded-ui-string | website_source/help/index.html | 43 |  | Recently updated |
| HARD-65 | medium | hardcoded-ui-string | website_source/help/index.html | 51 |  | Help categories |
| HARD-66 | medium | hardcoded-ui-string | website_source/help/index.html | 60 |  | Did not find an answer? |
| HARD-67 | medium | hardcoded-ui-string | website_source/help/index.html | 61 |  | Send a message to GlukoTrack support. |
| HARD-68 | medium | hardcoded-ui-string | website_source/help/index.html | 67 |  | Contact support |
| HARD-69 | medium | hardcoded-ui-string | website_source/help/index.html | 27 |  | Search help articles |
| HARD-70 | medium | hardcoded-ui-string | website_source/index.html | 24 |  | Web App |
| HARD-71 | medium | hardcoded-ui-string | website_source/index.html | 32 |  | 🇬🇧 English |
| HARD-72 | medium | hardcoded-ui-string | website_source/index.html | 33 |  | 🇩🇪 Deutsch |
| HARD-73 | medium | hardcoded-ui-string | website_source/index.html | 34 |  | 🇫🇷 Français |
| HARD-74 | medium | hardcoded-ui-string | website_source/index.html | 35 |  | 🇪🇸 Español |
| HARD-75 | medium | hardcoded-ui-string | website_source/index.html | 36 |  | 🇮🇹 Italiano |
| HARD-76 | medium | hardcoded-ui-string | website_source/index.html | 37 |  | 🇵🇱 Polski |
| HARD-77 | medium | hardcoded-ui-string | website_source/index.html | 38 |  | 🇺🇦 Українська |
| HARD-78 | medium | hardcoded-ui-string | website_source/index.html | 39 |  | 🇷🇺 Русский |
| HARD-79 | medium | hardcoded-ui-string | website_source/index.html | 40 |  | 🇵🇹 Português |
| HARD-80 | medium | hardcoded-ui-string | website_source/index.html | 41 |  | 🇳🇱 Nederlands |
| HARD-81 | medium | hardcoded-ui-string | website_source/index.html | 42 |  | 🇷🇴 Română |
| HARD-82 | medium | hardcoded-ui-string | website_source/index.html | 43 |  | 🇨🇿 Čeština |
| HARD-83 | medium | hardcoded-ui-string | website_source/index.html | 44 |  | 🇸🇰 Slovenčina |
| HARD-84 | medium | hardcoded-ui-string | website_source/index.html | 45 |  | 🇭🇺 Magyar |
| HARD-85 | medium | hardcoded-ui-string | website_source/index.html | 46 |  | 🇸🇪 Svenska |
| HARD-86 | medium | hardcoded-ui-string | website_source/index.html | 47 |  | 🇩🇰 Dansk |
| HARD-87 | medium | hardcoded-ui-string | website_source/index.html | 48 |  | 🇫🇮 Suomi |
| HARD-88 | medium | hardcoded-ui-string | website_source/index.html | 49 |  | 🇳🇴 Norsk |
| HARD-89 | medium | hardcoded-ui-string | website_source/index.html | 50 |  | 🇬🇷 Ελληνικά |
| HARD-90 | medium | hardcoded-ui-string | website_source/index.html | 51 |  | 🇹🇷 Türkçe |
| HARD-91 | medium | hardcoded-ui-string | website_source/index.html | 52 |  | 🇧🇬 Български |
| HARD-92 | medium | hardcoded-ui-string | website_source/index.html | 53 |  | 🇭🇷 Hrvatski |
| HARD-93 | medium | hardcoded-ui-string | website_source/index.html | 54 |  | 🇸🇮 Slovenščina |
| HARD-94 | medium | hardcoded-ui-string | website_source/index.html | 55 |  | 🇱🇹 Lietuvių |
| HARD-95 | medium | hardcoded-ui-string | website_source/index.html | 56 |  | 🇱🇻 Latviešu |
| HARD-96 | medium | hardcoded-ui-string | website_source/index.html | 57 |  | 🇪🇪 Eesti |
| HARD-97 | medium | hardcoded-ui-string | website_source/index.html | 58 |  | 🇷🇸 Српски |
| HARD-98 | medium | hardcoded-ui-string | website_source/index.html | 59 |  | 🇦🇱 Shqip |
| HARD-99 | medium | hardcoded-ui-string | website_source/index.html | 60 |  | 🇲🇰 Македонски |
| HARD-100 | medium | hardcoded-ui-string | website_source/index.html | 61 |  | 🇮🇸 Íslenska |
| HARD-101 | medium | hardcoded-ui-string | website_source/index.html | 71 |  | AI Health-Tech • Web • Android • iPhone |
| HARD-102 | medium | hardcoded-ui-string | website_source/index.html | 72 |  | GlukoTrack — smart diabetes control every day |
| HARD-103 | medium | hardcoded-ui-string | website_source/index.html | 73 |  | Glucose diary, nutrition, insulin, medication, reminders, emergency card and web application in one service. |
| HARD-104 | medium | hardcoded-ui-string | website_source/index.html | 75 |  | Open Web App |
| HARD-105 | medium | hardcoded-ui-string | website_source/index.html | 76 |  | View features |
| HARD-106 | medium | hardcoded-ui-string | website_source/index.html | 81 |  | Install GlukoTrack |
| HARD-107 | medium | hardcoded-ui-string | website_source/index.html | 83 |  | Scan with your phone |
| HARD-108 | medium | hardcoded-ui-string | website_source/index.html | 84 |  | Install app |
| HARD-109 | medium | hardcoded-ui-string | website_source/index.html | 88 |  | Glucose now |
| HARD-110 | medium | hardcoded-ui-string | website_source/index.html | 88 |  | mg/dL • |
| HARD-111 | medium | hardcoded-ui-string | website_source/index.html | 88 |  | in range |
| HARD-112 | medium | hardcoded-ui-string | website_source/index.html | 89 |  | Next measurement |
| HARD-113 | medium | hardcoded-ui-string | website_source/index.html | 90 |  | 42 g / 3.5 XE |
| HARD-114 | medium | hardcoded-ui-string | website_source/index.html | 91 |  | Informational calculation |
| HARD-115 | medium | hardcoded-ui-string | website_source/index.html | 99 |  | GlukoTrack — artificial intelligence that helps people live with diabetes |
| HARD-116 | medium | hardcoded-ui-string | website_source/index.html | 100 |  | GlukoTrack is a modern next-generation app created for people with diabetes. |
| HARD-117 | medium | hardcoded-ui-string | website_source/index.html | 103 |  | 🎙️ Voice control and AI |
| HARD-118 | medium | hardcoded-ui-string | website_source/index.html | 103 |  | View features |
| HARD-119 | medium | hardcoded-ui-string | website_source/index.html | 104 |  | 🧠 Artificial intelligence |
| HARD-120 | medium | hardcoded-ui-string | website_source/index.html | 104 |  | View features |
| HARD-121 | medium | hardcoded-ui-string | website_source/index.html | 105 |  | 📸 Nutrition calculation from a photo |
| HARD-122 | medium | hardcoded-ui-string | website_source/index.html | 105 |  | View features |
| HARD-123 | medium | hardcoded-ui-string | website_source/index.html | 106 |  | 👨‍👩‍👧 Remote monitoring |
| HARD-124 | medium | hardcoded-ui-string | website_source/index.html | 106 |  | View features |
| HARD-125 | medium | hardcoded-ui-string | website_source/index.html | 107 |  | 🆘 SOS card with geolocation |
| HARD-126 | medium | hardcoded-ui-string | website_source/index.html | 107 |  | View features |
| HARD-127 | medium | hardcoded-ui-string | website_source/index.html | 108 |  | 📊 Smart diary and integrations |
| HARD-128 | medium | hardcoded-ui-string | website_source/index.html | 108 |  | View features |
| HARD-129 | medium | hardcoded-ui-string | website_source/index.html | 113 |  | About GlukoTrack |
| HARD-130 | medium | hardcoded-ui-string | website_source/index.html | 119 |  | 🩺 |
| HARD-131 | medium | hardcoded-ui-string | website_source/index.html | 125 |  | GlukoTrack features |
| HARD-132 | medium | hardcoded-ui-string | website_source/index.html | 125 |  | Everything needed for daily diabetes self-management. |
| HARD-133 | medium | hardcoded-ui-string | website_source/index.html | 127 |  | 🩸 |
| HARD-134 | medium | hardcoded-ui-string | website_source/index.html | 127 |  | Glucose diary |
| HARD-135 | medium | hardcoded-ui-string | website_source/index.html | 127 |  | Measurements before and after meals, morning, evening and bedtime. |
| HARD-136 | medium | hardcoded-ui-string | website_source/index.html | 128 |  | 🍽️ |
| HARD-137 | medium | hardcoded-ui-string | website_source/index.html | 128 |  | Foods, carbohydrates, bread units and personal notes. |
| HARD-138 | medium | hardcoded-ui-string | website_source/index.html | 129 |  | 💉 |
| HARD-139 | medium | hardcoded-ui-string | website_source/index.html | 129 |  | Informational dose calculation from entered data. |
| HARD-140 | medium | hardcoded-ui-string | website_source/index.html | 130 |  | Glucose, medication, meals, insulin and wellbeing. |
| HARD-141 | medium | hardcoded-ui-string | website_source/index.html | 131 |  | 📊 |
| HARD-142 | medium | hardcoded-ui-string | website_source/index.html | 131 |  | History and charts |
| HARD-143 | medium | hardcoded-ui-string | website_source/index.html | 131 |  | Glucose, nutrition and wellbeing trends. |
| HARD-144 | medium | hardcoded-ui-string | website_source/index.html | 132 |  | 🚨 |
| HARD-145 | medium | hardcoded-ui-string | website_source/index.html | 132 |  | Emergency card |
| HARD-146 | medium | hardcoded-ui-string | website_source/index.html | 132 |  | Diabetes information and steps for loss of consciousness. |
| HARD-147 | medium | hardcoded-ui-string | website_source/index.html | 133 |  | 🌍 |
| HARD-148 | medium | hardcoded-ui-string | website_source/index.html | 133 |  | 30 languages |
| HARD-149 | medium | hardcoded-ui-string | website_source/index.html | 133 |  | One language selector for the application and website. |
| HARD-150 | medium | hardcoded-ui-string | website_source/index.html | 134 |  | 🔐 |
| HARD-151 | medium | hardcoded-ui-string | website_source/index.html | 134 |  | Registration, sign-in and access from multiple devices. |
| HARD-152 | medium | hardcoded-ui-string | website_source/index.html | 135 |  | 🤖 |
| HARD-153 | medium | hardcoded-ui-string | website_source/index.html | 135 |  | AI assistant |
| HARD-154 | medium | hardcoded-ui-string | website_source/index.html | 135 |  | Record analysis and self-management guidance. |
| HARD-155 | medium | hardcoded-ui-string | website_source/index.html | 142 |  | Open GlukoTrack Web App |
| HARD-156 | medium | hardcoded-ui-string | website_source/index.html | 143 |  | Referral program |
| HARD-157 | medium | hardcoded-ui-string | website_source/index.html | 150 |  | Choose the feature set that suits your care routine. |
| HARD-158 | medium | hardcoded-ui-string | website_source/index.html | 152 |  | 0 zł |
| HARD-159 | medium | hardcoded-ui-string | website_source/index.html | 152 |  | Basic glucose and nutrition diary. |
| HARD-160 | medium | hardcoded-ui-string | website_source/index.html | 153 |  | 19 zł |
| HARD-161 | medium | hardcoded-ui-string | website_source/index.html | 153 |  | Charts, full history, reminders and emergency card. |
| HARD-162 | medium | hardcoded-ui-string | website_source/index.html | 154 |  | 29 zł |
| HARD-163 | medium | hardcoded-ui-string | website_source/index.html | 154 |  | Family access and several profiles. |
| HARD-164 | medium | hardcoded-ui-string | website_source/index.html | 158 |  | Important medical warning |
| HARD-165 | medium | hardcoded-ui-string | website_source/index.html | 158 |  | GlukoTrack is informational software and a self-management diary. It is not a medical device and does not replace a doctor. Insulin, medication and treatment de |
| HARD-166 | medium | hardcoded-ui-string | website_source/index.html | 159 |  | User support and feedback. |
| HARD-167 | medium | hardcoded-ui-string | website_source/index.html | 159 |  | Email: |
| HARD-168 | medium | hardcoded-ui-string | website_source/index.html | 159 |  | support@glukotrack.com |
| HARD-169 | medium | hardcoded-ui-string | website_source/index.html | 159 |  | : glukotrack.com |
| HARD-170 | medium | hardcoded-ui-string | website_source/index.html | 160 |  | © 2026 GlukoTrack. |
| HARD-171 | medium | hardcoded-ui-string | website_source/index.html | 160 |  | All rights reserved. |
| HARD-172 | medium | hardcoded-ui-string | website_source/index.html | 80 |  | Install GlukoTrack |
| HARD-173 | medium | hardcoded-ui-string | website_source/index.html | 145 |  | GlukoTrack Web App |
| HARD-174 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | a\|\|this.moduleCount |
| HARD-175 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | b\|\|this.moduleCount |
| HARD-176 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | =a+c\|\|this.moduleCount |
| HARD-177 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | =b+d\|\|this.moduleCount |
| HARD-178 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | d\|\|this.moduleCount |
| HARD-179 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | "+8*l+")");for(g.getLengthInBits()+4 |
| HARD-180 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | m;m++)for(var j=0;j |
| HARD-181 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | m;m++)for(var j=0;j |
| HARD-182 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | =0;)b^=f.G15 |
| HARD-183 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | =0;)b^=f.G18 |
| HARD-184 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | h;h++)g.EXP_TABLE[h]=1 |
| HARD-185 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | i;i++)g.push(' |
| HARD-186 | medium | hardcoded-ui-string | website_source/install/qrcode.min.js | 1 |  | ');g.push(" |
| HARD-187 | medium | hardcoded-ui-string | website_source/r/index.html | 7 |  | GlukoTrack referral |
| HARD-188 | medium | hardcoded-ui-string | website_source/r/index.html | 59 |  | Открываем приглашение... |
| HARD-189 | medium | hardcoded-ui-string | website_source/r/index.html | 61 |  | Открыть приложение |
| HARD-190 | medium | hardcoded-ui-string | website_source/r/index.html | 62 |  | Код будет применён при регистрации нового аккаунта. |
| HARD-191 | medium | hardcoded-ui-string | android/app/src/main/kotlin/com/glukotrack/app/MainActivity.kt | 64 |  | ?: emptyMap |
| HARD-192 | medium | hardcoded-ui-string | android/app/src/main/kotlin/com/glukotrack/app/MainActivity.kt | 69 |  | ?: emptyMap |
| HARD-193 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 4 |  | Ask AI |
| HARD-194 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 5 |  | Voice recognition is already active |
| HARD-195 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 6 |  | Speech recognition is unavailable |
| HARD-196 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 11 |  | Blood type |
| HARD-197 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 16 |  | Emergency information |
| HARD-198 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 17 |  | If unconscious, call emergency services. Do not give insulin without checking glucose. |
| HARD-199 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 18 |  | Call 112 |
| HARD-200 | medium | hardcoded-ui-string | android/app/src/main/res/values/strings.xml | 19 |  | Call emergency contact |

Full machine-readable report: `reports/localization-static-audit.json`.

This report is not a claim that localization is fixed. It is the controlled queue for the correction phase.