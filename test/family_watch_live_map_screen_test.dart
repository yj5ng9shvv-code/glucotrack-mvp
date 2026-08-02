import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:glucotrack/family_watch/family_location_api.dart';
import 'package:glucotrack/family_watch/location_models.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/screens/family_watch_live_map_screen.dart';

void main() {
  Widget subject(Future<FamilyLocationPoint?> Function() loader) =>
      ChangeNotifierProvider(
        create: (_) => AppState(),
        child: MaterialApp(
          home: FamilyWatchLiveMapScreen(
            patientId: 'patient-1',
            patientName: 'Alex',
            token: 'test-token',
            locationLoader: loader,
            now: () => DateTime.utc(2026, 8, 2, 12),
            pollingInterval: const Duration(days: 1),
          ),
        ),
      );

  testWidgets('shows loading state while location request is pending',
      (tester) async {
    final pending = Completer<FamilyLocationPoint?>();
    await tester.pumpWidget(subject(() => pending.future));

    expect(find.byKey(const Key('family-map-loading')), findsOneWidget);
    pending.complete(null);
  });

  testWidgets('shows access denied state for a revoked grant', (tester) async {
    await tester.pumpWidget(subject(() => Future<FamilyLocationPoint?>.error(
        const FamilyLocationApiException(403))));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('family-map-denied')), findsOneWidget);
    expect(find.text('Location access unavailable'), findsOneWidget);
  });

  testWidgets('shows offline state when no location exists', (tester) async {
    await tester.pumpWidget(subject(() async => null));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('family-map-empty')), findsOneWidget);
    expect(find.text('OFFLINE'), findsOneWidget);
  });

  testWidgets('refresh action requests the current location again',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(subject(() async {
      calls++;
      return null;
    }));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('family-map-refresh')));
    await tester.pumpAndSettle();

    expect(calls, 2);
  });
}
