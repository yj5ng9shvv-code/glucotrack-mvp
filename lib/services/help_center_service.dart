import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_service.dart';

class HelpCenterService {
  HelpCenterService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<HelpHomeData> home(String locale) async {
    final cacheKey = 'help_home_$locale';
    final prefs = await SharedPreferences.getInstance();
    try {
      final result = await Future.wait([
        _get('/help/categories?locale=$locale'),
        _get('/help/popular?locale=$locale&limit=8'),
        _get('/help/articles?locale=$locale&limit=8'),
      ]);
      final data = HelpHomeData.fromJson({
        'categories': result[0]['rows'] ?? [],
        'popular': result[1]['rows'] ?? [],
        'recent': result[2]['rows'] ?? [],
      });
      await prefs.setString(cacheKey, jsonEncode(data.toJson()));
      return data;
    } catch (_) {
      final cached = prefs.getString(cacheKey);
      if (cached != null) {
        return HelpHomeData.fromJson(
          jsonDecode(cached) as Map<String, dynamic>,
        );
      }
      rethrow;
    }
  }

  Future<List<HelpArticleListItem>> search(String locale, String query) async {
    final json = await _get(
      '/help/search?locale=$locale&q=${Uri.encodeQueryComponent(query)}',
    );
    return (json['rows'] as List? ?? [])
        .whereType<Map>()
        .map(
          (item) =>
              HelpArticleListItem.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<List<HelpArticleListItem>> category(String locale, String slug) async {
    final json = await _get('/help/categories/$slug?locale=$locale');
    return (json['articles'] as List? ?? [])
        .whereType<Map>()
        .map(
          (item) =>
              HelpArticleListItem.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<HelpArticle> article(String locale, String slug) async {
    final cacheKey = 'help_article_${locale}_$slug';
    final prefs = await SharedPreferences.getInstance();
    try {
      final json = await _get('/help/articles/$slug?locale=$locale');
      final article = HelpArticle.fromJson(
        Map<String, dynamic>.from(json['article'] as Map),
      );
      await prefs.setString(cacheKey, jsonEncode(article.toJson()));
      return article;
    } catch (_) {
      final cached = prefs.getString(cacheKey);
      if (cached != null) {
        return HelpArticle.fromJson(jsonDecode(cached) as Map<String, dynamic>);
      }
      rethrow;
    }
  }

  Future<void> feedback({
    required String locale,
    required String slug,
    required bool helpful,
  }) async {
    await _post('/help/feedback', {
      'locale': locale,
      'slug': slug,
      'helpful': helpful,
    });
  }

  Future<void> contact({
    required String locale,
    required String email,
    required String subject,
    required String message,
  }) async {
    await _post('/help/contact', {
      'locale': locale,
      'email': email,
      'subject': subject,
      'message': message,
    });
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client.get(
      Uri.parse('${AuthService.apiBaseUrl}$path'),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client.post(
      Uri.parse('${AuthService.apiBaseUrl}$path'),
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final json = jsonDecode(response.body.isEmpty ? '{}' : response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        json is Map && json['code'] != null
            ? json['code'].toString()
            : 'HELP_REQUEST_FAILED',
      );
    }
    return Map<String, dynamic>.from(json as Map);
  }
}

class HelpHomeData {
  final List<HelpCategory> categories;
  final List<HelpArticleListItem> popular;
  final List<HelpArticleListItem> recent;

  const HelpHomeData({
    required this.categories,
    required this.popular,
    required this.recent,
  });

  factory HelpHomeData.fromJson(Map<String, dynamic> json) => HelpHomeData(
        categories: (json['categories'] as List? ?? [])
            .whereType<Map>()
            .map((item) =>
                HelpCategory.fromJson(Map<String, dynamic>.from(item)))
            .toList(),
        popular: (json['popular'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) =>
                  HelpArticleListItem.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(),
        recent: (json['recent'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) =>
                  HelpArticleListItem.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'categories': categories.map((item) => item.toJson()).toList(),
        'popular': popular.map((item) => item.toJson()).toList(),
        'recent': recent.map((item) => item.toJson()).toList(),
      };
}

class HelpCategory {
  final String slug;
  final String title;
  final String description;
  final int articleCount;

  const HelpCategory({
    required this.slug,
    required this.title,
    required this.description,
    required this.articleCount,
  });

  factory HelpCategory.fromJson(Map<String, dynamic> json) => HelpCategory(
        slug: json['slug']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        articleCount: int.tryParse(json['articleCount']?.toString() ?? '') ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'slug': slug,
        'title': title,
        'description': description,
        'articleCount': articleCount,
      };
}

class HelpArticleListItem {
  final String slug;
  final String title;
  final String summary;
  final String categoryTitle;

  const HelpArticleListItem({
    required this.slug,
    required this.title,
    required this.summary,
    required this.categoryTitle,
  });

  factory HelpArticleListItem.fromJson(Map<String, dynamic> json) =>
      HelpArticleListItem(
        slug: json['slug']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        summary: json['summary']?.toString() ?? '',
        categoryTitle: json['categoryTitle']?.toString() ?? '',
      );

  Map<String, dynamic> toJson() => {
        'slug': slug,
        'title': title,
        'summary': summary,
        'categoryTitle': categoryTitle,
      };
}

class HelpArticle extends HelpArticleListItem {
  final String content;

  const HelpArticle({
    required super.slug,
    required super.title,
    required super.summary,
    required super.categoryTitle,
    required this.content,
  });

  factory HelpArticle.fromJson(Map<String, dynamic> json) => HelpArticle(
        slug: json['slug']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        summary: json['summary']?.toString() ?? '',
        categoryTitle: json['categoryTitle']?.toString() ?? '',
        content: json['content']?.toString() ?? '',
      );

  @override
  Map<String, dynamic> toJson() => {...super.toJson(), 'content': content};
}
