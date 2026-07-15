import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../services/help_center_service.dart';

class HelpCenterScreen extends StatefulWidget {
  const HelpCenterScreen({super.key});

  @override
  State<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends State<HelpCenterScreen> {
  final _service = HelpCenterService();
  final _searchController = TextEditingController();
  final _emailController = TextEditingController();
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  Future<HelpHomeData>? _homeFuture;
  List<HelpArticleListItem> _results = const [];
  bool _searching = false;
  bool _contactSending = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _homeFuture ??= _service.home(_locale);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _emailController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  String get _locale => context.read<AppState>().languageCode;

  @override
  Widget build(BuildContext context) {
    final text = _HelpText(_locale);
    return Scaffold(
      appBar: AppBar(title: Text(text.label('title'))),
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() => _homeFuture = _service.home(_locale));
          await _homeFuture;
        },
        child: FutureBuilder<HelpHomeData>(
          future: _homeFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError && !snapshot.hasData) {
              return _ErrorView(
                message: text.label('error'),
                onRetry: () =>
                    setState(() => _homeFuture = _service.home(_locale)),
              );
            }
            final data = snapshot.data ??
                const HelpHomeData(categories: [], popular: [], recent: []);
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                Text(
                  text.label('subtitle'),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                SearchBar(
                  controller: _searchController,
                  hintText: text.label('search'),
                  leading: const Icon(Icons.search),
                  trailing: _searching
                      ? const [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        ]
                      : null,
                  onSubmitted: _search,
                ),
                if (_results.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _SectionTitle(text.label('results')),
                  ..._results.map(_ArticleTile.new),
                ],
                const SizedBox(height: 18),
                _SectionTitle(text.label('popular')),
                ...data.popular.map(_ArticleTile.new),
                const SizedBox(height: 18),
                _SectionTitle(text.label('categories')),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: data.categories.length,
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 260,
                    childAspectRatio: 1.35,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemBuilder: (context, index) =>
                      _CategoryTile(category: data.categories[index]),
                ),
                const SizedBox(height: 18),
                _SectionTitle(text.label('recent')),
                ...data.recent.map(_ArticleTile.new),
                const SizedBox(height: 18),
                _ContactCard(
                  text: text,
                  emailController: _emailController,
                  subjectController: _subjectController,
                  messageController: _messageController,
                  sending: _contactSending,
                  onSend: _sendContact,
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _search(String value) async {
    final query = value.trim();
    if (query.isEmpty) return;
    setState(() => _searching = true);
    try {
      final results = await _service.search(_locale, query);
      if (mounted) setState(() => _results = results);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _sendContact() async {
    if (_contactSending) return;
    final text = _HelpText(_locale);
    setState(() => _contactSending = true);
    try {
      await _service.contact(
        locale: _locale,
        email: _emailController.text.trim(),
        subject: _subjectController.text.trim(),
        message: _messageController.text.trim(),
      );
      _subjectController.clear();
      _messageController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(text.label('sent'))),
        );
      }
    } finally {
      if (mounted) setState(() => _contactSending = false);
    }
  }
}

class HelpArticleScreen extends StatefulWidget {
  final String slug;

  const HelpArticleScreen({super.key, required this.slug});

  @override
  State<HelpArticleScreen> createState() => _HelpArticleScreenState();
}

class _HelpArticleScreenState extends State<HelpArticleScreen> {
  final _service = HelpCenterService();
  Future<HelpArticle>? _future;
  bool _sendingFeedback = false;
  bool _feedbackSaved = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _service.article(_locale, widget.slug);
  }

  String get _locale => context.read<AppState>().languageCode;

  @override
  Widget build(BuildContext context) {
    final text = _HelpText(_locale);
    return Scaffold(
      appBar: AppBar(title: Text(text.label('title'))),
      body: FutureBuilder<HelpArticle>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return _ErrorView(
              message: text.label('error'),
              onRetry: () => setState(() {
                _future = _service.article(_locale, widget.slug);
              }),
            );
          }
          final article = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Text(article.categoryTitle,
                  style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              Text(article.title,
                  style: Theme.of(context).textTheme.headlineSmall),
              if (article.summary.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(article.summary),
              ],
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    _plainText(article.content),
                    style: const TextStyle(height: 1.45),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(text.label('feedback')),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: _sendingFeedback || _feedbackSaved
                        ? null
                        : () => _feedback(true),
                    icon: _sendingFeedback
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.thumb_up_alt_outlined),
                    label: Text(text.label('yes')),
                  ),
                  OutlinedButton.icon(
                    onPressed: _sendingFeedback || _feedbackSaved
                        ? null
                        : () => _feedback(false),
                    icon: const Icon(Icons.thumb_down_alt_outlined),
                    label: Text(text.label('no')),
                  ),
                ],
              ),
              if (_feedbackSaved) ...[
                const SizedBox(height: 8),
                Text(
                  text.label('sent'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _feedback(bool helpful) async {
    final text = _HelpText(_locale);
    setState(() => _sendingFeedback = true);
    try {
      await _service.feedback(
        locale: _locale,
        slug: widget.slug,
        helpful: helpful,
      );
      if (mounted) {
        setState(() => _feedbackSaved = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(text.label('sent'))),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _sendingFeedback = false);
    }
  }

  String _plainText(String html) => html
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'</p\s*>', caseSensitive: false), '\n\n')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .trim();
}

class _ArticleTile extends StatelessWidget {
  final HelpArticleListItem article;

  const _ArticleTile(this.article);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.article_outlined),
        title: Text(article.title),
        subtitle: Text(article.summary.isNotEmpty
            ? article.summary
            : article.categoryTitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => HelpArticleScreen(slug: article.slug),
          ),
        ),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  final HelpCategory category;

  const _CategoryTile({required this.category});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => _HelpCategoryScreen(category: category),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.help_outline),
              const SizedBox(height: 8),
              Text(category.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall),
              const Spacer(),
              Text(
                '${category.articleCount}',
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HelpCategoryScreen extends StatefulWidget {
  final HelpCategory category;

  const _HelpCategoryScreen({required this.category});

  @override
  State<_HelpCategoryScreen> createState() => _HelpCategoryScreenState();
}

class _HelpCategoryScreenState extends State<_HelpCategoryScreen> {
  final _service = HelpCenterService();
  Future<List<HelpArticleListItem>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _service.category(
      context.read<AppState>().languageCode,
      widget.category.slug,
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = _HelpText(context.read<AppState>().languageCode);
    return Scaffold(
      appBar: AppBar(title: Text(widget.category.title)),
      body: FutureBuilder<List<HelpArticleListItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snapshot.data ?? const [];
          if (rows.isEmpty) {
            return Center(child: Text(text.label('empty')));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: rows.map(_ArticleTile.new).toList(),
          );
        },
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final _HelpText text;
  final TextEditingController emailController;
  final TextEditingController subjectController;
  final TextEditingController messageController;
  final bool sending;
  final Future<void> Function() onSend;

  const _ContactCard({
    required this.text,
    required this.emailController,
    required this.subjectController,
    required this.messageController,
    required this.sending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(text.label('contact'),
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: text.label('email')),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: subjectController,
              decoration: InputDecoration(labelText: text.label('subject')),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: messageController,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(labelText: text.label('message')),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
              label: Text(text.label('send')),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;

  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final text = _HelpText(context.read<AppState>().languageCode);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: onRetry, child: Text(text.label('retry'))),
        ],
      ),
    );
  }
}

class _HelpText {
  final String locale;

  const _HelpText(this.locale);

  static const _strings = {
    'en': {
      'title': 'Help Center',
      'subtitle': 'Find answers about GlukoTrack.',
      'search': 'Search help articles',
      'results': 'Search results',
      'popular': 'Popular articles',
      'categories': 'Help categories',
      'recent': 'Recently updated',
      'contact': 'Contact support',
      'email': 'Email',
      'subject': 'Subject',
      'message': 'Message',
      'send': 'Send',
      'sent': 'Sent',
      'feedback': 'Was this article helpful?',
      'yes': 'Yes',
      'no': 'No',
      'empty': 'No articles',
      'error':
          'Help Center is not available. Cached articles may appear offline.',
      'retry': 'Retry',
    },
    'ru': {
      'title': '\u0421\u043F\u0440\u0430\u0432\u043A\u0430',
      'subtitle':
          '\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u043F\u043E GlukoTrack.',
      'search':
          '\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u0442\u0430\u0442\u044C\u044F\u043C',
      'results':
          '\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E\u0438\u0441\u043A\u0430',
      'popular':
          '\u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u044B\u0435 \u0441\u0442\u0430\u0442\u044C\u0438',
      'categories':
          '\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043F\u043E\u043C\u043E\u0449\u0438',
      'recent':
          '\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F',
      'contact':
          '\u0421\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u043E\u0439',
      'email': 'Email',
      'subject': '\u0422\u0435\u043C\u0430',
      'message': '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435',
      'send': '\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C',
      'sent': '\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E',
      'feedback':
          '\u0421\u0442\u0430\u0442\u044C\u044F \u0431\u044B\u043B\u0430 \u043F\u043E\u043B\u0435\u0437\u043D\u043E\u0439?',
      'yes': '\u0414\u0430',
      'no': '\u041D\u0435\u0442',
      'empty': '\u0421\u0442\u0430\u0442\u0435\u0439 \u043D\u0435\u0442',
      'error':
          '\u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043D\u044B\u0435 \u0441\u0442\u0430\u0442\u044C\u0438 \u043C\u043E\u0433\u0443\u0442 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C\u0441\u044F \u043E\u0444\u043B\u0430\u0439\u043D.',
      'retry': '\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C',
    },
  };

  String label(String key) {
    final direct = _strings[locale]?[key];
    if (direct != null) return direct;
    return _strings['en']![key] ?? key;
  }
}
