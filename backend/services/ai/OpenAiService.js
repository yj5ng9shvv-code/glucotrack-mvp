import OpenAI, { toFile } from 'openai';

export class OpenAiService {
  #client;

  constructor({ requiredEnv, OpenAIClient = OpenAI, toFileFactory = toFile }) {
    this.requiredEnv = requiredEnv;
    this.OpenAIClient = OpenAIClient;
    this.toFileFactory = toFileFactory;
  }

  get client() {
    if (!this.#client) {
      this.#client = new this.OpenAIClient({ apiKey: this.requiredEnv('OPENAI_API_KEY') });
    }
    return this.#client;
  }

  chat(options) {
    return this.client.chat.completions.create(options);
  }

  searchFood(options) {
    return this.client.chat.completions.create(options);
  }

  async transcribe({ buffer, filename, mimeType, model, language }) {
    const file = await this.toFileFactory(buffer, filename, { type: mimeType });
    return this.client.audio.transcriptions.create({ file, model, language });
  }

  recognizeFood(options) {
    return this.client.responses.create(options);
  }

  analyzeLab(options) {
    return this.client.responses.create(options);
  }

  analyzeMedication(options) {
    return this.client.chat.completions.create(options);
  }
}
