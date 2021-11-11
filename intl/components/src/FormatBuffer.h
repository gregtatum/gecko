/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef intl_components_FormatBuffer_h
#define intl_components_FormatBuffer_h

/**
 * This file contains public adaptors for the mozilla::intl Buffer template
 * argument. Adaptors that can automatically be deduced are kept as private
 * in ICU4CGlue.h. There is also the SpiderMonkey specific adaptor
 * js::intl::FormatBuffer in js/src/builtin/intl/FormatBuffer.h.
 *
 * Example buffer creation:
 *
 *      auto buffer = ToBuffer(aString);
 *      auto result = component->format(options, buffer);
 */

#ifndef JS_STANDALONE
// When building standalone js shell, it will include headers from
// intl/components if JS_HAS_INTL_API is true (the default value), but js shell
// won't include headers from XPCOM, so don't include nsTString.h when building
// standalone js shell.
#  include "nsTString.h"
#endif

namespace mozilla::intl {

#ifndef JS_STANDALONE
/**
 * mozilla::intl APIs require sizeable buffers. This class abstracts over
 * the nsTString.
 */
template <typename T>
class nsTStringToBufferAdapter {
 public:
  using CharType = T;

  // Do not allow copy or move. Move could be added in the future if needed.
  nsTStringToBufferAdapter(const nsTStringToBufferAdapter&) = delete;
  nsTStringToBufferAdapter& operator=(const nsTStringToBufferAdapter&) = delete;

  explicit nsTStringToBufferAdapter(nsTString<CharType>& aString)
      : mString(aString) {}

  /**
   * Ensures the buffer has enough space to accommodate |size| elements.
   */
  [[nodiscard]] bool reserve(size_t size) {
    return mString.SetLength(size, fallible);
  }

  /**
   * Returns the raw data inside the buffer.
   */
  CharType* data() { return mString.BeginWriting(); }

  /**
   * Returns the count of elements written into the buffer.
   */
  size_t length() const { return mString.Length(); }

  /**
   * Returns the buffer's overall capacity.
   */
  size_t capacity() const {
    // nsString's Capacity() method is protected, so just return the length.
    return mString.Length();
  }

  /**
   * Resizes the buffer to the given amount of written elements.
   */
  void written(size_t amount) {
    MOZ_ASSERT(amount <= mString.Length());
    // This sets |mString|'s internal size so that it matches how much was
    // written. This is necessary because the write happens across FFI
    // boundaries.
    mString.SetLength(amount);
  }

 private:
  nsTString<CharType>& mString;
};

#endif /* JS_STANDALONE */
}  // namespace mozilla::intl

#endif /* intl_components_FormatBuffer_h */
