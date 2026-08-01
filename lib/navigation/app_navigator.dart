import 'package:flutter/material.dart';

class AppNavigator {
  AppNavigator._();

  static final GlobalKey<NavigatorState> key = GlobalKey<NavigatorState>();

  static bool _transitionInProgress = false;

  static NavigatorState? get _navigator => key.currentState;

  static Future<T?> pushNamed<T extends Object?>(String routeName) {
    return _runGuarded(() => _navigator?.pushNamed<T>(routeName));
  }

  static Future<T?> pushReplacementNamed<T extends Object?, TO extends Object?>(
    String routeName, {
    TO? result,
  }) {
    return _runGuarded(
      () => _navigator?.pushReplacementNamed<T, TO>(routeName, result: result),
    );
  }

  static Future<T?> pushNamedAndRemoveUntil<T extends Object?>(
    String routeName,
    RoutePredicate predicate,
  ) {
    return _runGuarded(
      () => _navigator?.pushNamedAndRemoveUntil<T>(routeName, predicate),
    );
  }

  static void popUntilRoot() {
    final navigator = _navigator;
    if (navigator == null) return;
    navigator.popUntil((route) => route.isFirst);
  }

  static Future<T?> _runGuarded<T>(Future<T?>? Function() action) async {
    if (_transitionInProgress) return null;
    final navigator = _navigator;
    if (navigator == null || !navigator.mounted) return null;
    _transitionInProgress = true;
    final future = action();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _transitionInProgress = false;
    });
    if (future == null) return null;
    return future;
  }
}
