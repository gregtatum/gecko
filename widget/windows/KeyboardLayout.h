/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef KeyboardLayout_h__
#define KeyboardLayout_h__

#include "nscore.h"
#include "nsAutoPtr.h"
#include "nsEvent.h"
#include "nsString.h"
#include "nsWindowBase.h"
#include <windows.h>

#define NS_NUM_OF_KEYS          68

#define VK_OEM_1                0xBA   // ';:' for US
#define VK_OEM_PLUS             0xBB   // '+' any country
#define VK_OEM_COMMA            0xBC
#define VK_OEM_MINUS            0xBD   // '-' any country
#define VK_OEM_PERIOD           0xBE
#define VK_OEM_2                0xBF
#define VK_OEM_3                0xC0
// '/?' for Brazilian (ABNT)
#define VK_ABNT_C1              0xC1
// Separator in Numpad for Brazilian (ABNT) or JIS keyboard for Mac.
#define VK_ABNT_C2              0xC2
#define VK_OEM_4                0xDB
#define VK_OEM_5                0xDC
#define VK_OEM_6                0xDD
#define VK_OEM_7                0xDE
#define VK_OEM_8                0xDF
#define VK_OEM_102              0xE2
#define VK_OEM_CLEAR            0xFE

struct nsModifierKeyState;

namespace mozilla {
namespace widget {

class KeyboardLayout;

class ModifierKeyState {
public:
  ModifierKeyState()
  {
    Update();
  }

  ModifierKeyState(bool aIsShiftDown, bool aIsControlDown, bool aIsAltDown)
  {
    Update();
    Unset(MODIFIER_SHIFT | MODIFIER_CONTROL | MODIFIER_ALT | MODIFIER_ALTGRAPH);
    Modifiers modifiers = 0;
    if (aIsShiftDown) {
      modifiers |= MODIFIER_SHIFT;
    }
    if (aIsControlDown) {
      modifiers |= MODIFIER_CONTROL;
    }
    if (aIsAltDown) {
      modifiers |= MODIFIER_ALT;
    }
    if (modifiers) {
      Set(modifiers);
    }
  }

  ModifierKeyState(Modifiers aModifiers) :
    mModifiers(aModifiers)
  {
    EnsureAltGr();
  }

  void Update();

  void Unset(Modifiers aRemovingModifiers)
  {
    mModifiers &= ~aRemovingModifiers;
    // Note that we don't need to unset AltGr flag here automatically.
    // For nsEditor, we need to remove Alt and Control flags but AltGr isn't
    // checked in nsEditor, so, it can be kept.
  }

  void Set(Modifiers aAddingModifiers)
  {
    mModifiers |= aAddingModifiers;
    EnsureAltGr();
  }

  void InitInputEvent(nsInputEvent& aInputEvent) const;

  bool IsShift() const { return (mModifiers & MODIFIER_SHIFT) != 0; }
  bool IsControl() const { return (mModifiers & MODIFIER_CONTROL) != 0; }
  bool IsAlt() const { return (mModifiers & MODIFIER_ALT) != 0; }
  bool IsAltGr() const { return IsControl() && IsAlt(); }
  bool IsWin() const { return (mModifiers & MODIFIER_OS) != 0; }

  bool IsCapsLocked() const { return (mModifiers & MODIFIER_CAPSLOCK) != 0; }
  bool IsNumLocked() const { return (mModifiers & MODIFIER_NUMLOCK) != 0; }
  bool IsScrollLocked() const
  {
    return (mModifiers & MODIFIER_SCROLLLOCK) != 0;
  }

  Modifiers GetModifiers() const { return mModifiers; }

private:
  Modifiers mModifiers;

  void EnsureAltGr()
  {
    // If both Control key and Alt key are pressed, it means AltGr is pressed.
    // Ideally, we should check whether the current keyboard layout has AltGr
    // or not.  However, setting AltGr flags for keyboard which doesn't have
    // AltGr must not be serious bug.  So, it should be OK for now.
    if (IsAltGr()) {
      mModifiers |= MODIFIER_ALTGRAPH;
    }
  }

  void InitMouseEvent(nsInputEvent& aMouseEvent) const;
};

struct UniCharsAndModifiers
{
  // Dead-key + up to 4 characters
  PRUnichar mChars[5];
  Modifiers mModifiers[5];
  uint32_t  mLength;

  UniCharsAndModifiers() : mLength(0) {}
  UniCharsAndModifiers operator+(const UniCharsAndModifiers& aOther) const;
  UniCharsAndModifiers& operator+=(const UniCharsAndModifiers& aOther);

  /**
   * Append a pair of unicode character and the final modifier.
   */
  void Append(PRUnichar aUniChar, Modifiers aModifiers);
  void Clear() { mLength = 0; }

  void FillModifiers(Modifiers aModifiers);

  bool UniCharsEqual(const UniCharsAndModifiers& aOther) const;
  bool UniCharsCaseInsensitiveEqual(const UniCharsAndModifiers& aOther) const;

  nsString ToString() const { return nsString(mChars, mLength); }
};

struct DeadKeyEntry;
class DeadKeyTable;


class VirtualKey
{
public:
  //  0 - Normal
  //  1 - Shift
  //  2 - Control
  //  3 - Control + Shift
  //  4 - Alt
  //  5 - Alt + Shift
  //  6 - Alt + Control (AltGr)
  //  7 - Alt + Control + Shift (AltGr + Shift)
  //  8 - CapsLock
  //  9 - CapsLock + Shift
  // 10 - CapsLock + Control
  // 11 - CapsLock + Control + Shift
  // 12 - CapsLock + Alt
  // 13 - CapsLock + Alt + Shift
  // 14 - CapsLock + Alt + Control (CapsLock + AltGr)
  // 15 - CapsLock + Alt + Control + Shift (CapsLock + AltGr + Shift)

  enum ShiftStateFlag
  {
    STATE_SHIFT    = 0x01,
    STATE_CONTROL  = 0x02,
    STATE_ALT      = 0x04,
    STATE_CAPSLOCK = 0x08
  };

  typedef uint8_t ShiftState;

  static ShiftState ModifiersToShiftState(Modifiers aModifiers)
  {
    ShiftState state = 0;
    if (aModifiers & MODIFIER_SHIFT) {
      state |= STATE_SHIFT;
    }
    if (aModifiers & MODIFIER_CONTROL) {
      state |= STATE_CONTROL;
    }
    if (aModifiers & MODIFIER_ALT) {
      state |= STATE_ALT;
    }
    if (aModifiers & MODIFIER_CAPSLOCK) {
      state |= STATE_CAPSLOCK;
    }
    return state;
  }

  static Modifiers ShiftStateToModifiers(ShiftState aShiftState)
  {
    Modifiers modifiers = 0;
    if (aShiftState & STATE_SHIFT) {
      modifiers |= MODIFIER_SHIFT;
    }
    if (aShiftState & STATE_CONTROL) {
      modifiers |= MODIFIER_CONTROL;
    }
    if (aShiftState & STATE_ALT) {
      modifiers |= MODIFIER_ALT;
    }
    if (aShiftState & STATE_CAPSLOCK) {
      modifiers |= MODIFIER_CAPSLOCK;
    }
    if ((modifiers & (MODIFIER_ALT | MODIFIER_CONTROL)) ==
           (MODIFIER_ALT | MODIFIER_CONTROL)) {
      modifiers |= MODIFIER_ALTGRAPH;
    }
    return modifiers;
  }

private:
  union KeyShiftState
  {
    struct
    {
      PRUnichar Chars[4];
    } Normal;
    struct
    {
      const DeadKeyTable* Table;
      PRUnichar DeadChar;
    } DeadKey;
  };

  KeyShiftState mShiftStates[16];
  uint16_t mIsDeadKey;

  void SetDeadKey(ShiftState aShiftState, bool aIsDeadKey)
  {
    if (aIsDeadKey) {
      mIsDeadKey |= 1 << aShiftState;
    } else {
      mIsDeadKey &= ~(1 << aShiftState);
    }
  }

public:
  static void FillKbdState(PBYTE aKbdState, const ShiftState aShiftState);

  bool IsDeadKey(ShiftState aShiftState) const
  {
    return (mIsDeadKey & (1 << aShiftState)) != 0;
  }

  void AttachDeadKeyTable(ShiftState aShiftState,
                          const DeadKeyTable* aDeadKeyTable)
  {
    mShiftStates[aShiftState].DeadKey.Table = aDeadKeyTable;
  }

  void SetNormalChars(ShiftState aShiftState, const PRUnichar* aChars,
                      uint32_t aNumOfChars);
  void SetDeadChar(ShiftState aShiftState, PRUnichar aDeadChar);
  const DeadKeyTable* MatchingDeadKeyTable(const DeadKeyEntry* aDeadKeyArray,
                                           uint32_t aEntries) const;
  inline PRUnichar GetCompositeChar(ShiftState aShiftState,
                                    PRUnichar aBaseChar) const;
  UniCharsAndModifiers GetNativeUniChars(ShiftState aShiftState) const;
  UniCharsAndModifiers GetUniChars(ShiftState aShiftState) const;
};

class MOZ_STACK_CLASS NativeKey
{
  friend class KeyboardLayout;

public:
  NativeKey(nsWindowBase* aWidget,
            const MSG& aKeyOrCharMessage,
            const ModifierKeyState& aModKeyState);

  uint32_t GetDOMKeyCode() const { return mDOMKeyCode; }
  KeyNameIndex GetKeyNameIndex() const { return mKeyNameIndex; }
  const UniCharsAndModifiers& GetCommittedCharsAndModifiers() const
  {
    return mCommittedCharsAndModifiers;
  }

  UINT GetMessage() const { return mMessage; }
  bool IsKeyDownMessage() const
  {
    return (mMessage == WM_KEYDOWN || mMessage == WM_SYSKEYDOWN);
  }
  WORD GetScanCode() const { return mScanCode; }
  uint8_t GetVirtualKeyCode() const { return mVirtualKeyCode; }
  uint8_t GetOriginalVirtualKeyCode() const { return mOriginalVirtualKeyCode; }

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK.
   */
  uint8_t ComputeVirtualKeyCodeFromScanCode() const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK_EX.
   */
  uint8_t ComputeVirtualKeyCodeFromScanCodeEx() const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK and MAPVK_VK_TO_CHAR.
   */
  PRUnichar ComputeUnicharFromScanCode() const;

  /**
   * Initializes the aKeyEvent with the information stored in the instance.
   */
  void InitKeyEvent(nsKeyEvent& aKeyEvent,
                    const ModifierKeyState& aModKeyState) const;
  void InitKeyEvent(nsKeyEvent& aKeyEvent) const
  {
    InitKeyEvent(aKeyEvent, mModKeyState);
  }

private:
  nsRefPtr<nsWindowBase> mWidget;
  HKL mKeyboardLayout;
  uint32_t mDOMKeyCode;
  KeyNameIndex mKeyNameIndex;

  // The message which the instance was initialized with.
  UINT mMessage;

  ModifierKeyState mModKeyState;

  // mVirtualKeyCode distinguishes left key or right key of modifier key.
  uint8_t mVirtualKeyCode;
  // mOriginalVirtualKeyCode doesn't distinguish left key or right key of
  // modifier key.  However, if the given keycode is VK_PROCESS, it's resolved
  // to a keycode before it's handled by IME.
  uint8_t mOriginalVirtualKeyCode;

  // mCommittedChars indicates the inputted characters which is committed by
  // the key.  If dead key fail to composite a character, mCommittedChars
  // indicates both the dead characters and the base characters.
  UniCharsAndModifiers mCommittedCharsAndModifiers;

  WORD    mScanCode;
  bool    mIsExtended;

  NativeKey()
  {
    MOZ_NOT_REACHED("The default constructor of NativeKey isn't available");
  }

  UINT GetScanCodeWithExtendedFlag() const;

  // The result is one of nsIDOMKeyEvent::DOM_KEY_LOCATION_*.
  uint32_t GetKeyLocation() const;
};

class KeyboardLayout
{
  friend class NativeKey;

private:
  KeyboardLayout();
  ~KeyboardLayout();

  static KeyboardLayout* sInstance;

  struct DeadKeyTableListEntry
  {
    DeadKeyTableListEntry* next;
    uint8_t data[1];
  };

  HKL mKeyboardLayout;

  VirtualKey mVirtualKeys[NS_NUM_OF_KEYS];
  DeadKeyTableListEntry* mDeadKeyTableListHead;
  int32_t mActiveDeadKey;                 // -1 = no active dead-key
  VirtualKey::ShiftState mDeadKeyShiftState;

  bool mIsOverridden : 1;
  bool mIsPendingToRestoreKeyboardLayout : 1;

  static inline int32_t GetKeyIndex(uint8_t aVirtualKey);
  static int CompareDeadKeyEntries(const void* aArg1, const void* aArg2,
                                   void* aData);
  static bool AddDeadKeyEntry(PRUnichar aBaseChar, PRUnichar aCompositeChar,
                                DeadKeyEntry* aDeadKeyArray, uint32_t aEntries);
  bool EnsureDeadKeyActive(bool aIsActive, uint8_t aDeadKey,
                             const PBYTE aDeadKeyKbdState);
  uint32_t GetDeadKeyCombinations(uint8_t aDeadKey,
                                  const PBYTE aDeadKeyKbdState,
                                  uint16_t aShiftStatesWithBaseChars,
                                  DeadKeyEntry* aDeadKeyArray,
                                  uint32_t aMaxEntries);
  void DeactivateDeadKeyState();
  const DeadKeyTable* AddDeadKeyTable(const DeadKeyEntry* aDeadKeyArray,
                                      uint32_t aEntries);
  void ReleaseDeadKeyTables();

  /**
   * Loads the specified keyboard layout. This method always clear the dead key
   * state.
   */
  void LoadLayout(HKL aLayout);

  /**
   * InitNativeKey() must be called when actually widget receives WM_KEYDOWN or
   * WM_KEYUP.  This method is stateful.  This saves current dead key state at
   * WM_KEYDOWN.  Additionally, computes current inputted character(s) and set
   * them to the aNativeKey.
   */
  void InitNativeKey(NativeKey& aNativeKey,
                     const ModifierKeyState& aModKeyState);

public:
  static KeyboardLayout* GetInstance();
  static void Shutdown();

  static bool IsPrintableCharKey(uint8_t aVirtualKey);

  /**
   * IsDeadKey() returns true if aVirtualKey is a dead key with aModKeyState.
   * This method isn't stateful.
   */
  bool IsDeadKey(uint8_t aVirtualKey,
                 const ModifierKeyState& aModKeyState) const;

  /**
   * GetUniCharsAndModifiers() returns characters which is inputted by the
   * aVirtualKey with aModKeyState.  This method isn't stateful.
   */
  UniCharsAndModifiers GetUniCharsAndModifiers(
                         uint8_t aVirtualKey,
                         const ModifierKeyState& aModKeyState) const;

  /**
   * OnLayoutChange() must be called before the first keydown message is
   * received.  LoadLayout() changes the keyboard state, that causes breaking
   * dead key state.  Therefore, we need to load the layout before the first
   * keydown message.
   */
  void OnLayoutChange(HKL aKeyboardLayout)
  {
    MOZ_ASSERT(!mIsOverridden);
    LoadLayout(aKeyboardLayout);
  }

  /**
   * OverrideLayout() loads the specified keyboard layout.
   */
  void OverrideLayout(HKL aLayout)
  {
    mIsOverridden = true;
    LoadLayout(aLayout);
  }

  /**
   * RestoreLayout() loads the current keyboard layout of the thread.
   */
  void RestoreLayout()
  {
    mIsOverridden = false;
    mIsPendingToRestoreKeyboardLayout = true;
  }

  uint32_t ConvertNativeKeyCodeToDOMKeyCode(UINT aNativeKeyCode) const;

  /**
   * ConvertNativeKeyCodeToKeyNameIndex() returns KeyNameIndex value for
   * non-printable keys (except some special keys like space key).
   */
  KeyNameIndex ConvertNativeKeyCodeToKeyNameIndex(uint8_t aVirtualKey) const;

  HKL GetLayout() const
  {
    return mIsPendingToRestoreKeyboardLayout ? ::GetKeyboardLayout(0) :
                                               mKeyboardLayout;
  }

  /**
   * This wraps MapVirtualKeyEx() API with MAPVK_VK_TO_VSC.
   */
  WORD ComputeScanCodeForVirtualKeyCode(uint8_t aVirtualKeyCode) const;
};

} // namespace widget
} // namespace mozilla

#endif
