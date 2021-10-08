/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "gtest/gtest.h"

#include "mozilla/intl/Bidi.h"
#include "mozilla/Span.h"
namespace mozilla::intl {

TEST(IntlBidi, SimpleLTR)
{
  Bidi bidi{};
  ASSERT_TRUE(bidi.SetParagraph(MakeStringSpan(u"this is a paragraph"),
                                Bidi::Direction::LTR)
                  .isOk());
  ASSERT_EQ(bidi.GetParagraphEmbeddingLevel().GetExplicitValue(), 0);
  ASSERT_EQ(bidi.GetParagraphDirection(), Bidi::ParagraphDirection::LTR);

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string,
              MakeStringSpan(u"this is a paragraph"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.Direction(),
              Bidi::Direction::LTR);
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 0);
  }

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_TRUE(logicalRun.inspect().isNothing());
  }
}

TEST(IntlBidi, SimpleRTL)
{
  Bidi bidi{};
  ASSERT_TRUE(
      bidi.SetParagraph(MakeStringSpan(u"فايرفوكس رائع "), Bidi::Direction::LTR)
          .isOk());
  ASSERT_EQ(bidi.GetParagraphEmbeddingLevel().GetExplicitValue(), 1);
  ASSERT_EQ(bidi.GetParagraphDirection(), Bidi::ParagraphDirection::RTL);

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string, MakeStringSpan(u"فايرفوكس رائع "));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.Direction(),
              Bidi::Direction::RTL);
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 1);
  }

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_TRUE(logicalRun.inspect().isNothing());
  }
}

TEST(IntlBidi, MultiLevel)
{
  Bidi bidi{};
  ASSERT_TRUE(
      bidi.SetParagraph(MakeStringSpan(u"Firefox is awesome: رائع Firefox"),
                        Bidi::Direction::LTR)
          .isOk());
  ASSERT_EQ(bidi.GetParagraphEmbeddingLevel().GetExplicitValue(), 0);
  ASSERT_EQ(bidi.GetParagraphDirection(), Bidi::ParagraphDirection::Mixed);

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string,
              MakeStringSpan(u"Firefox is awesome: "));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 0);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string, MakeStringSpan(u"رائع"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 1);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string, MakeStringSpan(u" Firefox"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 0);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_TRUE(logicalRun.inspect().isNothing());
  }
}

TEST(IntlBidi, RtlOverride)
{
  Bidi bidi{};
  // Set the paragraph using the RTL embedding mark U+202B, and the LTR
  // embedding mark U+202A to increase the embedding level. This mark switches
  // the weakly directional character "_". This demonstrates that embedding
  // levels can be computed.
  ASSERT_TRUE(
      bidi.SetParagraph(MakeStringSpan(u"ltr\u202b___رائع___\u202a___ltr__"),
                        Bidi::Direction::LTR)
          .isOk());
  ASSERT_EQ(bidi.GetParagraphEmbeddingLevel().GetExplicitValue(), 0);
  ASSERT_EQ(bidi.GetParagraphDirection(), Bidi::ParagraphDirection::Mixed);

  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string, MakeStringSpan(u"ltr"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 0);
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.Direction(),
              Bidi::Direction::LTR);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string,
              MakeStringSpan(u"\u202b___رائع___"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 1);
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.Direction(),
              Bidi::Direction::RTL);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_EQ(logicalRun.inspect()->string, MakeStringSpan(u"\u202a___ltr__"));
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.GetExplicitValue(), 2);
    ASSERT_EQ(logicalRun.inspect()->embeddingLevel.Direction(),
              Bidi::Direction::LTR);
  }
  {
    auto logicalRun = bidi.GetNextLogicalRun();
    ASSERT_TRUE(logicalRun.isOk());
    ASSERT_TRUE(logicalRun.inspect().isNothing());
  }
}

TEST(IntlBidi, VisualRuns)
{
  Bidi bidi{};
  auto result = bidi.GetVisualRuns(
      MakeStringSpan(
          u"first visual run التشغيل البصري الثاني third visual run"),
      Bidi::Direction::LTR);
  ASSERT_TRUE(result.isOk());
  auto iter = result.unwrap();
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u"first visual run "));
    ASSERT_EQ(run->direction, Bidi::Direction::LTR);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u"التشغيل البصري الثاني"));
    ASSERT_EQ(run->direction, Bidi::Direction::RTL);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u" third visual run"));
    ASSERT_EQ(run->direction, Bidi::Direction::LTR);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isNothing());
  }
}

TEST(IntlBidi, VisualRunsWhileLoop)
{
  Bidi bidi{};
  auto result = bidi.GetVisualRuns(
      MakeStringSpan(
          u"first visual run التشغيل البصري الثاني third visual run"),
      Bidi::Direction::LTR);
  ASSERT_TRUE(result.isOk());
  auto iter = result.unwrap();
  size_t ltr = 0;
  size_t rtl = 0;
  while (Maybe<Bidi::VisualRun> run = iter.Next()) {
    if (run->direction == Bidi::Direction::LTR) {
      ltr++;
    } else {
      rtl++;
    }
  }
  ASSERT_EQ(ltr, static_cast<size_t>(2));
  ASSERT_EQ(rtl, static_cast<size_t>(1));
}

TEST(IntlBidi, VisualRunsWithEmbeds)
{
  // Compare this test to the logical order.
  Bidi bidi{};
  auto result =
      bidi.GetVisualRuns(MakeStringSpan(u"ltr\u202b___رائع___\u202a___ltr___"),
                         Bidi::Direction::LTR);
  ASSERT_TRUE(result.isOk());
  auto iter = result.unwrap();
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u"ltr"));
    ASSERT_EQ(run->direction, Bidi::Direction::LTR);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u"\u202a___ltr___"));
    ASSERT_EQ(run->direction, Bidi::Direction::LTR);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isSome());
    ASSERT_EQ(run->string, MakeStringSpan(u"\u202b___رائع___"));
    ASSERT_EQ(run->direction, Bidi::Direction::RTL);
  }
  {
    Maybe<Bidi::VisualRun> run = iter.Next();
    ASSERT_TRUE(run.isNothing());
  }
}

}  // namespace mozilla::intl
