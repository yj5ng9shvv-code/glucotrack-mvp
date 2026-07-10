# GlukoTrack

GlukoTrack is a Flutter application for diabetes self-management, AI assistance, family monitoring, and emergency safety features.

## Included
- Medical-style UI
- Home dashboard
- Insulin recommendation calculator
- Food catalog with recommendations
- AI Assistant with OpenAI-compatible API integration and local fallback
- Premium subscription screen placeholder
- Profile and medical calculation settings

## Important medical note
This app is not a medical device in its current form. Insulin calculations are informational only and must be validated with a physician/endocrinologist before real-world use.

## Run
```bash
flutter pub get
flutter run
```

## AI Assistant
By default the chat works in a local fallback mode. To enable cloud AI, pass an API key at build/run time:

```bash
flutter run --dart-define=OPENAI_API_KEY=your_api_key
```

Optional settings:

```bash
flutter run --dart-define=OPENAI_API_KEY=your_api_key --dart-define=OPENAI_MODEL=gpt-4o-mini --dart-define=OPENAI_BASE_URL=https://api.openai.com/v1
```

Do not hard-code production API keys in the Flutter client. For a real release, route requests through your backend.

## Food recognition
The food photo scanner supports two remote modes and a local fallback.

Recommended production mode: send photos to your backend, keep the OpenAI key on the server, and return the app JSON schema:

```bash
flutter run --dart-define=FOOD_RECOGNITION_ENDPOINT=https://your-api.example.com/ai/recognize-food
```

Development-only direct OpenAI mode:

```bash
flutter run --dart-define=OPENAI_API_KEY=your_api_key --dart-define=OPENAI_VISION_MODEL=gpt-4o-mini
```

Expected recognition JSON:

```json
{
  "foods": [
    {
      "name": "Гречка отварная",
      "portion_grams": 100,
      "carbs_per_100g": 21,
      "carbs_grams": 21,
      "calories": 110,
      "confidence": 0.75,
      "note": "Порция оценена по фото"
    }
  ],
  "total_carbs_grams": 21,
  "total_calories": 110,
  "warnings": ["Проверьте вес порции вручную"],
  "summary": "На фото похожа порция гречки"
}
```

## Next steps
1. Add Firebase Auth and Firestore.
2. Add real AI Vision backend.
3. Add in-app purchases for Apple and Google.
4. Add Libre/Dexcom/Apple Health/Health Connect integrations where legally and technically possible.
5. Add full localization: ru, uk, en, de, fr, pl.
