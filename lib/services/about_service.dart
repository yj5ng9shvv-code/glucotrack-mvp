import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_service.dart';

class AboutService {
  AboutService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<AboutContent> content(String locale) async {
    final cacheKey = 'about_content_$locale';
    final prefs = await SharedPreferences.getInstance();
    try {
      final response = await _client.get(
        Uri.parse('${AuthService.apiBaseUrl}/about?locale=$locale'),
      );
      final json = _decode(response);
      final content = AboutContent.fromJson(
        Map<String, dynamic>.from(json['content'] as Map),
      );
      await prefs.setString(cacheKey, jsonEncode(content.toJson()));
      return content;
    } catch (_) {
      final cached = prefs.getString(cacheKey);
      if (cached != null) {
        return AboutContent.fromJson(
          jsonDecode(cached) as Map<String, dynamic>,
        );
      }
      rethrow;
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    final json = jsonDecode(response.body.isEmpty ? '{}' : response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('ABOUT_REQUEST_FAILED');
    }
    return Map<String, dynamic>.from(json as Map);
  }
}

class AboutContent {
  const AboutContent({
    required this.locale,
    required this.title,
    required this.tagline,
    required this.shortDescription,
    required this.heroTitle,
    required this.heroSubtitle,
    required this.whatIsTitle,
    required this.paragraphs,
    required this.advantagesTitle,
    required this.advantages,
    required this.disclaimerTitle,
    required this.disclaimerText,
    required this.links,
  });

  final String locale;
  final String title;
  final String tagline;
  final String shortDescription;
  final String heroTitle;
  final String heroSubtitle;
  final String whatIsTitle;
  final List<String> paragraphs;
  final String advantagesTitle;
  final List<AboutAdvantage> advantages;
  final String disclaimerTitle;
  final String disclaimerText;
  final Map<String, String> links;

  factory AboutContent.fromJson(Map<String, dynamic> json) {
    final hero = Map<String, dynamic>.from(json['hero'] as Map? ?? {});
    final whatIs = Map<String, dynamic>.from(json['whatIs'] as Map? ?? {});
    final disclaimer = Map<String, dynamic>.from(
      json['medicalDisclaimer'] as Map? ?? {},
    );
    final linksJson = Map<String, dynamic>.from(json['links'] as Map? ?? {});
    return AboutContent(
      locale: (json['locale'] ?? 'en').toString(),
      title: (json['title'] ?? 'About GlukoTrack').toString(),
      tagline: (json['tagline'] ?? '').toString(),
      shortDescription: (json['shortDescription'] ?? '').toString(),
      heroTitle:
          (hero['title'] ?? json['title'] ?? 'About GlukoTrack').toString(),
      heroSubtitle:
          (hero['subtitle'] ?? json['shortDescription'] ?? '').toString(),
      whatIsTitle: (whatIs['title'] ?? '').toString(),
      paragraphs: (whatIs['paragraphs'] as List? ?? [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
      advantagesTitle: (json['advantagesTitle'] ?? '').toString(),
      advantages: (json['advantages'] as List? ?? [])
          .whereType<Map>()
          .map(
            (item) => AboutAdvantage.fromJson(Map<String, dynamic>.from(item)),
          )
          .where((item) => item.isActive)
          .toList(),
      disclaimerTitle: (disclaimer['title'] ?? '').toString(),
      disclaimerText: (disclaimer['text'] ?? '').toString(),
      links: linksJson.map((key, value) => MapEntry(key, value.toString())),
    );
  }

  Map<String, dynamic> toJson() => {
        'locale': locale,
        'title': title,
        'tagline': tagline,
        'shortDescription': shortDescription,
        'hero': {'title': heroTitle, 'subtitle': heroSubtitle},
        'whatIs': {'title': whatIsTitle, 'paragraphs': paragraphs},
        'advantagesTitle': advantagesTitle,
        'advantages': advantages.map((item) => item.toJson()).toList(),
        'medicalDisclaimer': {'title': disclaimerTitle, 'text': disclaimerText},
        'links': links,
      };
}

class AboutAdvantage {
  const AboutAdvantage({
    required this.key,
    required this.title,
    required this.description,
    required this.isActive,
  });

  final String key;
  final String title;
  final String description;
  final bool isActive;

  factory AboutAdvantage.fromJson(Map<String, dynamic> json) => AboutAdvantage(
        key: (json['key'] ?? '').toString(),
        title: (json['title'] ?? '').toString(),
        description: (json['description'] ?? '').toString(),
        isActive: json['isActive'] != false,
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'title': title,
        'description': description,
        'isActive': isActive,
      };
}
