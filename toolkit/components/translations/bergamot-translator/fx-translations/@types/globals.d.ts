type TranslationsEnginePayload = import("../../../translations.d.ts").TranslationsEnginePayload
type ModelRecord = import("../../../translations.d.ts").TranslationModelRecord;
type WasmRecord = import("../../../translations.d.ts").WasmRecord;
type Attachment = import("../../../translations.d.ts").Attachment;
type LanguageTranslationModelFiles = import("../../../translations.d.ts").LanguageTranslationModelFiles;
type LanguageTranslationModelFile = import("../../../translations.d.ts").LanguageTranslationModelFile;

interface ObjectConstructor {
  entries<T extends object>(o: T): Entries<T>
  values<T extends object>(o: T): T
}
