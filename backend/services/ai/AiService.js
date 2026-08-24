export class AiService {
  constructor(adapter) {
    this.adapter = adapter;
  }

  chat(options) {
    return this.adapter.chat(options);
  }

  searchFood(options) {
    return this.adapter.searchFood(options);
  }

  transcribe(options) {
    return this.adapter.transcribe(options);
  }

  recognizeFood(options) {
    return this.adapter.recognizeFood(options);
  }

  analyzeLab(options) {
    return this.adapter.analyzeLab(options);
  }

  analyzeMedication(options) {
    return this.adapter.analyzeMedication(options);
  }
}
