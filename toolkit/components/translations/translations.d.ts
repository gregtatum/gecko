/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains the shared types for translations. The intended use is for
 * defining types to be used in JSDoc. They are used in a form that the TypeScript
 * language server can read them, and provide code hints.
 */

/**
 * For Remote Settings, the JSON details about the attachment.
 */
export interface Attachment {
   // e.g. "2f7c0f7bbc...ca79f0850c4de",
  hash: string;
  // e.g. 5047568,
  size: string;
  // e.g. "lex.50.50.deen.s2t.bin",
  filename: string;
  // e.g. "main-workspace/translations-models/316ebb3a-0682-42cc-8e73-a3ba4bbb280f.bin",
  location: string;
  // e.g. "application/octet-stream"
  mimetype: string;
}

/**
 * The JSON that is synced from Remote Settings for the translation models.
 */
export interface ModelRecord {
  // The model name  e.g. "lex.50.50.deen.s2t.bin"
  name: string;
  // e.g. "de"
  fromLang: string;
  // e.g. "en"
  toLang: string;
  // e.g. 1
  version: number;
  // e.g. "lex"
  fileType: string;
  // e.g. Attachment
  attachment: string;
  // e.g. "0d4db293-a17c-4085-9bd8-e2e146c85000"
  id: string;
  // e.g. 1673023100578
  schema: number;
  // e.g. 1673455932527
  last_modified: string;
}

/**
 * The JSON that is synced from Remote Settings for the wasm binaries.
 */
export interface WasmRecord {
  // The name of the project, e.g. "bergamot-translator"
  name: string;
  // The human readable identifier for the release. e.g. "v0.4.4"
  release: string;
  // The commit hash for the project that generated the wasm.
  revision: string;
  // The license of the wasm, as a https://spdx.org/licenses/
  license: string;
}

/**
 * This message structure is passed back and forth with the worker.
 */
export interface TranslationMessage {
  messageID: number,
  sourceParagraph: string,
  sourceLanguage: string,
  targetLanguage: string,
  translatedParagraph?: string,
  tabId?: any,
  frameId?: any,
  origin?: any,
  type?: any,
}

/**
 * The module interface returned from the Bergamot wasm library.
 *
 * https://github.com/mozilla/bergamot-translator/blob/main/wasm/bindings/service_bindings.cpp
 */
export interface BergamotModule {
  BlockingService: typeof BlockingService;
  AlignedMemoryList: typeof AlignedMemoryList;
  TranslationModel: typeof TranslationModel;
  AlignedMemory: typeof AlignedMemory;
  VectorResponseOptions: typeof VectorResponseOptions;
  VectorString: typeof VectorString;
}

export class Vector<T> {
  size(): number;
  get(index: number): T;
  push_back(item: T);
}

export class VectorResponse extends Vector<Response> {}
export class VectorString extends Vector<string> {}
export class VectorResponseOptions extends Vector<ResponseOptions> {}
export class AlignedMemoryList extends Vector<AlignedMemory> {}

/**
 * A blocking (e.g. non-threaded) translation service, via Bergamot.
 */
export class BlockingService {
  /**
   * Translate multiple text-blogs in a single blocking API call.
   */
  translate(
    translationModel,
    vectorSourceText: VectorString,
    vectorResponseOptions: VectorResponseOptions
  ): VectorResponse;

  translateViaPivoting(
    first: TranslationModel,
    second: TranslationModel,
    vectorSourceText: VectorString,
    vectorResponseOptions: VectorResponseOptions
  ): VectorResponse;
}

/**
 * The actual translation model.
 */
export class TranslationModel {

}

/**
 * The models need to be placed in the wasm memory space. This object represents
 * aligned memory that was allocated on the wasm side of things. The memory contents
 * can be set via the getByteArrayView method and the Uint8Array.prototype.set method.
 */
export class AlignedMemory {
  constructor(size: number, alignment: number);
  size(): number;
  getByteArrayView(): Uint8Array;
}

/**
 * This definition isn't complete, but just contains the methods that are being
 * used in the worker.
 *
 * See https://github.com/mozilla/bergamot-translator/blob/main/src/translator/response.h
 */
export class Response {
  getOriginalText(): string;
  getTranslatedText(): string;
}

/**
 *
 */
export class ResponseOptions {

}


export interface LanguageModelBlobs {
  // The language pair, e.g. "enes" for "en" -> "es".
  name: string;
  withQualityEstimation: boolean;
  blobs: Record<ModelTypes, Blob>;
  precision: string;
}

/**
 * TODO(Docs) - Document or point to documentation for what all of these are and mean.
 */
export type ModelTypes =
  // This is the actual translation model.
  | "model"
  | "lex"
  // This model determines a quality score for the results.
  | "qualityModel"
  // A vocab list that contains both the source and target vocab list.
  | "vocab"
  // The source and target vocab lists come as a pair.
  | "srcvocab"
  | "trgvocab";
