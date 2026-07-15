# GlukoTrack Localization Static Audit

Generated: 2026-07-15T18:29:53.827Z

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
- Translation keys union: 547
- Used keys detected in Flutter UI: 472
- Findings total: 7837
- High: 7028
- Medium: 748
- Low: 61
- Missing keys: 7024
- Hardcoded UI strings: 288
- Mojibake findings: 0

## Findings By Kind

- missing-translation-key: 7024
- english-looking-translation: 460
- hardcoded-ui-string: 288
- same-as-english-many-locales: 61
- key-as-value: 4

## First 200 Findings

| ID | Severity | Kind | File | Line | Locale/Key | Value |
| --- | --- | --- | --- | ---: | --- | --- |
| KEY-1 | high | key-as-value | lib/l10n/app_localizations.dart | 2367 | de / kcal |  |
| KEY-2 | high | key-as-value | lib/l10n/app_localizations.dart | 3103 | de / kcal |  |
| KEY-3 | high | key-as-value | lib/l10n/app_localizations.dart | 3255 | fr / kcal |  |
| KEY-4 | high | key-as-value | lib/l10n/app_localizations.dart | 3404 | pl / kcal |  |
| ENG-5 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 158 | de / gdpr.profileTitle | Privacy and GDPR |
| ENG-6 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 159 | de / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-7 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 160 | de / gdpr.title | Privacy and GDPR |
| ENG-8 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 161 | de / gdpr.create | Create request |
| ENG-9 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 162 | de / gdpr.createTitle | New GDPR request |
| ENG-10 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 163 | de / gdpr.loginRequiredTitle | Sign in required |
| ENG-11 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 164 | de / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-12 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 168 | de / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-13 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 169 | de / gdpr.type | Request type |
| ENG-14 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 174 | de / gdpr.submit | Submit request |
| ENG-15 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 176 | de / gdpr.downloadExport | Download export |
| ENG-16 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 177 | de / gdpr.cancel | Cancel request |
| ENG-17 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 178 | de / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-18 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 188 | de / gdpr.type.account_deletion | Delete my account |
| ENG-19 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 194 | de / gdpr.type.other | Other request |
| ENG-20 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 197 | de / gdpr.status.identity_verification_required | Identity required |
| ENG-21 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 201 | de / gdpr.status.waiting_for_user | Waiting for you |
| ENG-22 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 230 | de / notifications.errorText | Check the connection and try again. |
| ENG-23 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 236 | de / referral.inviteCode | Your invite code |
| ENG-24 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 239 | de / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-25 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 285 | fr / gdpr.profileTitle | Privacy and GDPR |
| ENG-26 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 286 | fr / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-27 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 287 | fr / gdpr.title | Privacy and GDPR |
| ENG-28 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 288 | fr / gdpr.create | Create request |
| ENG-29 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 289 | fr / gdpr.createTitle | New GDPR request |
| ENG-30 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 290 | fr / gdpr.loginRequiredTitle | Sign in required |
| ENG-31 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 291 | fr / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-32 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 295 | fr / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-33 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 296 | fr / gdpr.type | Request type |
| ENG-34 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 301 | fr / gdpr.submit | Submit request |
| ENG-35 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 303 | fr / gdpr.downloadExport | Download export |
| ENG-36 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 304 | fr / gdpr.cancel | Cancel request |
| ENG-37 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 305 | fr / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-38 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 315 | fr / gdpr.type.account_deletion | Delete my account |
| ENG-39 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 321 | fr / gdpr.type.other | Other request |
| ENG-40 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 324 | fr / gdpr.status.identity_verification_required | Identity required |
| ENG-41 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 328 | fr / gdpr.status.waiting_for_user | Waiting for you |
| ENG-42 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 357 | fr / notifications.errorText | Check the connection and try again. |
| ENG-43 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 363 | fr / referral.inviteCode | Your invite code |
| ENG-44 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 366 | fr / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-45 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 412 | es / gdpr.profileTitle | Privacy and GDPR |
| ENG-46 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 413 | es / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-47 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 414 | es / gdpr.title | Privacy and GDPR |
| ENG-48 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 415 | es / gdpr.create | Create request |
| ENG-49 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 416 | es / gdpr.createTitle | New GDPR request |
| ENG-50 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 417 | es / gdpr.loginRequiredTitle | Sign in required |
| ENG-51 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 418 | es / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-52 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 422 | es / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-53 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 423 | es / gdpr.type | Request type |
| ENG-54 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 428 | es / gdpr.submit | Submit request |
| ENG-55 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 430 | es / gdpr.downloadExport | Download export |
| ENG-56 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 431 | es / gdpr.cancel | Cancel request |
| ENG-57 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 432 | es / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-58 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 442 | es / gdpr.type.account_deletion | Delete my account |
| ENG-59 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 448 | es / gdpr.type.other | Other request |
| ENG-60 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 451 | es / gdpr.status.identity_verification_required | Identity required |
| ENG-61 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 455 | es / gdpr.status.waiting_for_user | Waiting for you |
| ENG-62 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 484 | es / notifications.errorText | Check the connection and try again. |
| ENG-63 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 490 | es / referral.inviteCode | Your invite code |
| ENG-64 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 493 | es / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-65 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 539 | it / gdpr.profileTitle | Privacy and GDPR |
| ENG-66 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 540 | it / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-67 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 541 | it / gdpr.title | Privacy and GDPR |
| ENG-68 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 542 | it / gdpr.create | Create request |
| ENG-69 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 543 | it / gdpr.createTitle | New GDPR request |
| ENG-70 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 544 | it / gdpr.loginRequiredTitle | Sign in required |
| ENG-71 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 545 | it / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-72 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 549 | it / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-73 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 550 | it / gdpr.type | Request type |
| ENG-74 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 555 | it / gdpr.submit | Submit request |
| ENG-75 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 557 | it / gdpr.downloadExport | Download export |
| ENG-76 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 558 | it / gdpr.cancel | Cancel request |
| ENG-77 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 559 | it / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-78 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 569 | it / gdpr.type.account_deletion | Delete my account |
| ENG-79 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 575 | it / gdpr.type.other | Other request |
| ENG-80 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 578 | it / gdpr.status.identity_verification_required | Identity required |
| ENG-81 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 582 | it / gdpr.status.waiting_for_user | Waiting for you |
| ENG-82 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 611 | it / notifications.errorText | Check the connection and try again. |
| ENG-83 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 617 | it / referral.inviteCode | Your invite code |
| ENG-84 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 620 | it / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-85 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 666 | pl / gdpr.profileTitle | Privacy and GDPR |
| ENG-86 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 667 | pl / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-87 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 668 | pl / gdpr.title | Privacy and GDPR |
| ENG-88 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 669 | pl / gdpr.create | Create request |
| ENG-89 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 670 | pl / gdpr.createTitle | New GDPR request |
| ENG-90 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 671 | pl / gdpr.loginRequiredTitle | Sign in required |
| ENG-91 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 672 | pl / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-92 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 676 | pl / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-93 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 677 | pl / gdpr.type | Request type |
| ENG-94 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 682 | pl / gdpr.submit | Submit request |
| ENG-95 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 684 | pl / gdpr.downloadExport | Download export |
| ENG-96 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 685 | pl / gdpr.cancel | Cancel request |
| ENG-97 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 686 | pl / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-98 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 696 | pl / gdpr.type.account_deletion | Delete my account |
| ENG-99 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 702 | pl / gdpr.type.other | Other request |
| ENG-100 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 705 | pl / gdpr.status.identity_verification_required | Identity required |
| ENG-101 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 709 | pl / gdpr.status.waiting_for_user | Waiting for you |
| ENG-102 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 738 | pl / notifications.errorText | Check the connection and try again. |
| ENG-103 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 744 | pl / referral.inviteCode | Your invite code |
| ENG-104 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 747 | pl / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-105 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1049 | pt / gdpr.profileTitle | Privacy and GDPR |
| ENG-106 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1050 | pt / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-107 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1051 | pt / gdpr.title | Privacy and GDPR |
| ENG-108 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1052 | pt / gdpr.create | Create request |
| ENG-109 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1053 | pt / gdpr.createTitle | New GDPR request |
| ENG-110 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1054 | pt / gdpr.loginRequiredTitle | Sign in required |
| ENG-111 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1055 | pt / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-112 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1059 | pt / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-113 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1060 | pt / gdpr.type | Request type |
| ENG-114 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1065 | pt / gdpr.submit | Submit request |
| ENG-115 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1067 | pt / gdpr.downloadExport | Download export |
| ENG-116 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1068 | pt / gdpr.cancel | Cancel request |
| ENG-117 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1069 | pt / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-118 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1079 | pt / gdpr.type.account_deletion | Delete my account |
| ENG-119 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1085 | pt / gdpr.type.other | Other request |
| ENG-120 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1088 | pt / gdpr.status.identity_verification_required | Identity required |
| ENG-121 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1092 | pt / gdpr.status.waiting_for_user | Waiting for you |
| ENG-122 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1121 | pt / notifications.errorText | Check the connection and try again. |
| ENG-123 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1127 | pt / referral.inviteCode | Your invite code |
| ENG-124 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1130 | pt / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-125 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1176 | nl / gdpr.profileTitle | Privacy and GDPR |
| ENG-126 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1177 | nl / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-127 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1178 | nl / gdpr.title | Privacy and GDPR |
| ENG-128 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1179 | nl / gdpr.create | Create request |
| ENG-129 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1180 | nl / gdpr.createTitle | New GDPR request |
| ENG-130 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1181 | nl / gdpr.loginRequiredTitle | Sign in required |
| ENG-131 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1182 | nl / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-132 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1186 | nl / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-133 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1187 | nl / gdpr.type | Request type |
| ENG-134 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1192 | nl / gdpr.submit | Submit request |
| ENG-135 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1194 | nl / gdpr.downloadExport | Download export |
| ENG-136 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1195 | nl / gdpr.cancel | Cancel request |
| ENG-137 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1196 | nl / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-138 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1206 | nl / gdpr.type.account_deletion | Delete my account |
| ENG-139 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1212 | nl / gdpr.type.other | Other request |
| ENG-140 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1215 | nl / gdpr.status.identity_verification_required | Identity required |
| ENG-141 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1219 | nl / gdpr.status.waiting_for_user | Waiting for you |
| ENG-142 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1248 | nl / notifications.errorText | Check the connection and try again. |
| ENG-143 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1254 | nl / referral.inviteCode | Your invite code |
| ENG-144 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1257 | nl / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-145 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1303 | ro / gdpr.profileTitle | Privacy and GDPR |
| ENG-146 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1304 | ro / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-147 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1305 | ro / gdpr.title | Privacy and GDPR |
| ENG-148 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1306 | ro / gdpr.create | Create request |
| ENG-149 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1307 | ro / gdpr.createTitle | New GDPR request |
| ENG-150 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1308 | ro / gdpr.loginRequiredTitle | Sign in required |
| ENG-151 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1309 | ro / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-152 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1313 | ro / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-153 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1314 | ro / gdpr.type | Request type |
| ENG-154 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1319 | ro / gdpr.submit | Submit request |
| ENG-155 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1321 | ro / gdpr.downloadExport | Download export |
| ENG-156 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1322 | ro / gdpr.cancel | Cancel request |
| ENG-157 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1323 | ro / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-158 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1333 | ro / gdpr.type.account_deletion | Delete my account |
| ENG-159 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1339 | ro / gdpr.type.other | Other request |
| ENG-160 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1342 | ro / gdpr.status.identity_verification_required | Identity required |
| ENG-161 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1346 | ro / gdpr.status.waiting_for_user | Waiting for you |
| ENG-162 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1375 | ro / notifications.errorText | Check the connection and try again. |
| ENG-163 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1381 | ro / referral.inviteCode | Your invite code |
| ENG-164 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1384 | ro / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-165 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1430 | cs / gdpr.profileTitle | Privacy and GDPR |
| ENG-166 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1431 | cs / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-167 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1432 | cs / gdpr.title | Privacy and GDPR |
| ENG-168 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1433 | cs / gdpr.create | Create request |
| ENG-169 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1434 | cs / gdpr.createTitle | New GDPR request |
| ENG-170 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1435 | cs / gdpr.loginRequiredTitle | Sign in required |
| ENG-171 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1436 | cs / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-172 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1440 | cs / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-173 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1441 | cs / gdpr.type | Request type |
| ENG-174 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1446 | cs / gdpr.submit | Submit request |
| ENG-175 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1448 | cs / gdpr.downloadExport | Download export |
| ENG-176 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1449 | cs / gdpr.cancel | Cancel request |
| ENG-177 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1450 | cs / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-178 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1460 | cs / gdpr.type.account_deletion | Delete my account |
| ENG-179 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1466 | cs / gdpr.type.other | Other request |
| ENG-180 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1469 | cs / gdpr.status.identity_verification_required | Identity required |
| ENG-181 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1473 | cs / gdpr.status.waiting_for_user | Waiting for you |
| ENG-182 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1502 | cs / notifications.errorText | Check the connection and try again. |
| ENG-183 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1508 | cs / referral.inviteCode | Your invite code |
| ENG-184 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1511 | cs / referral.rewardNote | Reward is granted after the invited user verifies email and completes the first real Premium payment. |
| ENG-185 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1557 | sk / gdpr.profileTitle | Privacy and GDPR |
| ENG-186 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1558 | sk / gdpr.profileSubtitle | Data export, deletion and privacy requests |
| ENG-187 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1559 | sk / gdpr.title | Privacy and GDPR |
| ENG-188 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1560 | sk / gdpr.create | Create request |
| ENG-189 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1561 | sk / gdpr.createTitle | New GDPR request |
| ENG-190 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1562 | sk / gdpr.loginRequiredTitle | Sign in required |
| ENG-191 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1563 | sk / gdpr.loginRequiredText | Sign in to manage privacy requests. |
| ENG-192 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1567 | sk / gdpr.emptyText | Create a request to export, correct or delete your data. |
| ENG-193 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1568 | sk / gdpr.type | Request type |
| ENG-194 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1573 | sk / gdpr.submit | Submit request |
| ENG-195 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1575 | sk / gdpr.downloadExport | Download export |
| ENG-196 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1576 | sk / gdpr.cancel | Cancel request |
| ENG-197 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1577 | sk / gdpr.cancelConfirm | Cancel this GDPR request? |
| ENG-198 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1587 | sk / gdpr.type.account_deletion | Delete my account |
| ENG-199 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1593 | sk / gdpr.type.other | Other request |
| ENG-200 | medium | english-looking-translation | lib/l10n/profile_extra_translations.dart | 1596 | sk / gdpr.status.identity_verification_required | Identity required |

Full machine-readable report: `reports/localization-static-audit.json`.

This report is not a claim that localization is fixed. It is the controlled queue for the correction phase.