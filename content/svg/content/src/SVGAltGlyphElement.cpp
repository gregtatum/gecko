/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/SVGAltGlyphElement.h"
#include "mozilla/dom/SVGAltGlyphElementBinding.h"
#include "nsContentUtils.h"

NS_IMPL_NS_NEW_NAMESPACED_SVG_ELEMENT(AltGlyph)

namespace mozilla {
namespace dom {

JSObject*
SVGAltGlyphElement::WrapNode(JSContext *aCx, JS::Handle<JSObject*> aScope)
{
  return SVGAltGlyphElementBinding::Wrap(aCx, aScope, this);
}

nsSVGElement::StringInfo SVGAltGlyphElement::sStringInfo[1] =
{
  { &nsGkAtoms::href, kNameSpaceID_XLink, false }
};


//----------------------------------------------------------------------
// Implementation

SVGAltGlyphElement::SVGAltGlyphElement(already_AddRefed<nsINodeInfo> aNodeInfo)
  : SVGAltGlyphElementBase(aNodeInfo)
{
}

//----------------------------------------------------------------------
// nsIDOMNode methods

NS_IMPL_ELEMENT_CLONE_WITH_INIT(SVGAltGlyphElement)

already_AddRefed<nsIDOMSVGAnimatedString>
SVGAltGlyphElement::Href()
{
  return mStringAttributes[HREF].ToDOMAnimatedString(this);
}

void
SVGAltGlyphElement::GetGlyphRef(nsAString & aGlyphRef)
{
  GetAttr(kNameSpaceID_None, nsGkAtoms::glyphRef, aGlyphRef);
}

void
SVGAltGlyphElement::SetGlyphRef(const nsAString & aGlyphRef, ErrorResult& rv)
{
  rv = SetAttr(kNameSpaceID_None, nsGkAtoms::glyphRef, aGlyphRef, true);
}

void
SVGAltGlyphElement::GetFormat(nsAString & aFormat)
{
  GetAttr(kNameSpaceID_None, nsGkAtoms::format, aFormat);
}

void
SVGAltGlyphElement::SetFormat(const nsAString & aFormat, ErrorResult& rv)
{
  rv = SetAttr(kNameSpaceID_None, nsGkAtoms::format, aFormat, true);
}

//----------------------------------------------------------------------
// nsIContent methods

NS_IMETHODIMP_(bool)
SVGAltGlyphElement::IsAttributeMapped(const nsIAtom* name) const
{
  static const MappedAttributeEntry* const map[] = {
    sColorMap,
    sFillStrokeMap,
    sFontSpecificationMap,
    sGraphicsMap,
    sTextContentElementsMap
  };

  return FindAttributeDependence(name, map) ||
    SVGAltGlyphElementBase::IsAttributeMapped(name);
}

//----------------------------------------------------------------------
// nsSVGElement overrides

bool
SVGAltGlyphElement::IsEventName(nsIAtom* aName)
{
  return nsContentUtils::IsEventAttributeName(aName, EventNameType_SVGGraphic);
}

nsSVGElement::StringAttributesInfo
SVGAltGlyphElement::GetStringInfo()
{
  return StringAttributesInfo(mStringAttributes, sStringInfo,
                              ArrayLength(sStringInfo));
}

} // namespace dom
} // namespace mozilla
