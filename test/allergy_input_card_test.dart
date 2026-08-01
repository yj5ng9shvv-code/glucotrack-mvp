import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/widgets/allergy_input_card.dart';

void main() {
  testWidgets('allergy choice buttons emit explicit yes and no values', (
    tester,
  ) async {
    bool? changedTo;
    final controller = TextEditingController(text: 'peanuts');
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState()..languageCode = 'en',
        child: MaterialApp(
          home: Scaffold(
            body: AllergyInputCard(
              hasAllergies: true,
              detailsController: controller,
              onChanged: (value) => changedTo = value,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Allergy'));
    expect(changedTo, isFalse);

    await tester.tap(find.text('No'));
    expect(changedTo, isFalse);

    await tester.tap(find.text('Yes').last);
    expect(changedTo, isTrue);
  });
}
