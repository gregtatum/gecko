/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CustomEvent_h__
#define CustomEvent_h__

#include "mozilla/dom/Event.h"
#include "nsIDOMCustomEvent.h"

namespace mozilla {
namespace dom {

struct CustomEventInit;

class CustomEvent MOZ_FINAL : public Event,
                              public nsIDOMCustomEvent
{
private:
  virtual ~CustomEvent();

  nsCOMPtr<nsIVariant> mDetail;

public:
  CustomEvent(mozilla::dom::EventTarget* aOwner,
              nsPresContext* aPresContext = nullptr,
              mozilla::WidgetEvent* aEvent = nullptr);

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_CYCLE_COLLECTION_CLASS_INHERITED(CustomEvent, Event)
  NS_FORWARD_TO_EVENT
  NS_DECL_NSIDOMCUSTOMEVENT

  static already_AddRefed<CustomEvent>
  Constructor(const GlobalObject& aGlobal,
              const nsAString& aType,
              const CustomEventInit& aParam,
              ErrorResult& aRv);

  virtual JSObject*
  WrapObject(JSContext* aCx) MOZ_OVERRIDE;

  void
  GetDetail(JSContext* aCx,
            JS::MutableHandle<JS::Value> aRetval);

  void
  InitCustomEvent(JSContext* aCx,
                  const nsAString& aType,
                  bool aCanBubble,
                  bool aCancelable,
                  JS::Handle<JS::Value> aDetail,
                  ErrorResult& aRv);
};

} // namespace dom
} // namespace mozilla

#endif // CustomEvent_h__
