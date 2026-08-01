const usage = { prompt_tokens: 0, completion_tokens: 0 };

export class MockAiService {
  #response(content) {
    return {
      mode: 'mock',
      model: 'mock-ai',
      usage,
      choices: [{ message: { content } }]
    };
  }

  chat() {
    return this.#response('Mock AI response');
  }

  searchFood() {
    return this.#response(JSON.stringify({ items: [], disclaimer: 'Mock AI response' }));
  }

  transcribe() {
    return { mode: 'mock', model: 'mock-ai', usage, text: 'Mock transcription' };
  }

  recognizeFood() {
    return {
      mode: 'mock',
      model: 'mock-ai',
      usage,
      output_text: JSON.stringify({ foods: [], total_carbs_grams: 0, total_calories: 0, warnings: [], summary: 'Mock AI response' })
    };
  }

  analyzeLab() {
    return { mode: 'mock', model: 'mock-ai', usage, output_text: 'Mock laboratory analysis' };
  }

  analyzeMedication() {
    return this.#response('Mock medication analysis');
  }
}
