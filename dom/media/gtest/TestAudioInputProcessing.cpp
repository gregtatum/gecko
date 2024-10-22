/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gmock/gmock.h"
#include "gtest/gtest.h"

#include "AudioGenerator.h"
#include "MediaEngineWebRTCAudio.h"
#include "MediaTrackGraphImpl.h"
#include "mozilla/Attributes.h"
#include "mozilla/UniquePtr.h"
#include "mozilla/Unused.h"
#include "nsTArray.h"

using namespace mozilla;
using testing::NiceMock;
using testing::Return;

class MockGraph : public MediaTrackGraphImpl {
 public:
  MockGraph(TrackRate aRate, uint32_t aChannels)
      : MediaTrackGraphImpl(OFFLINE_THREAD_DRIVER, DIRECT_DRIVER, aRate,
                            aChannels, nullptr, AbstractThread::MainThread()) {
    ON_CALL(*this, OnGraphThread).WillByDefault(Return(true));
    // Remove this graph's driver since it holds a ref. If no AppendMessage
    // takes place, the driver never starts. This will also make sure no-one
    // tries to use it. We are still kept alive by the self-ref. Destroy() must
    // be called to break that cycle.
    SetCurrentDriver(nullptr);
  }

  MOCK_CONST_METHOD0(OnGraphThread, bool());

 protected:
  ~MockGraph() = default;
};

// AudioInputProcessing will put extra frames as pre-buffering data to avoid
// glitchs in non pass-through mode. The main goal of the test is to check how
// many frames left in the AudioInputProcessing's mSegment in various situations
// after input data has been processed.
TEST(TestAudioInputProcessing, Buffering)
{
  const TrackRate rate = 8000;  // So packet size is 80
  const uint32_t channels = 1;
  auto graph = MakeRefPtr<NiceMock<MockGraph>>(rate, channels);
  auto aip = MakeRefPtr<AudioInputProcessing>(channels, PRINCIPAL_HANDLE_NONE);

  const size_t frames = 72;

  AudioGenerator<AudioDataValue> generator(channels, rate);
  GraphTime processedTime;
  GraphTime nextTime;
  AudioSegment output;

  // Toggle pass-through mode without starting
  {
    EXPECT_EQ(aip->PassThrough(graph), false);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);

    aip->SetPassThrough(graph, true);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);

    aip->SetPassThrough(graph, false);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);

    aip->SetPassThrough(graph, true);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);
  }

  {
    // Need (nextTime - processedTime) = 128 - 0 = 128 frames this round.
    // aip has not started and set to processing mode yet, so output will be
    // filled with silence data directly.
    processedTime = 0;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);
  }

  // Set aip to processing/non-pass-through mode
  aip->SetPassThrough(graph, false);
  {
    // Need (nextTime - processedTime) = 256 - 128 = 128 frames this round.
    // aip has not started yet, so output will be filled with silence data
    // directly.
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(2 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);
  }

  // aip has been started and set to processing mode so it will insert 80 frames
  // into aip's internal buffer as pre-buffering.
  aip->Start(graph);
  {
    // Need (nextTime - processedTime) = 256 - 256 = 0 frames this round.
    // The Process() aip will take 0 frames from input, packetize and process
    // these frames into 0 80-frame packet(0 frames left in packetizer), insert
    // packets into aip's internal buffer, then move 0 frames the internal
    // buffer to output, leaving 80 + 0 - 0 = 80 frames in aip's internal
    // buffer.
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(3 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 80);
  }

  {
    // Need (nextTime - processedTime) = 384 - 256 = 128 frames this round.
    // The Process() aip will take 128 frames from input, packetize and process
    // these frames into floor(128/80) = 1 80-frame packet (48 frames left in
    // packetizer), insert packets into aip's internal buffer, then move 128
    // frames the internal buffer to output, leaving 80 + 80 - 128 = 32 frames
    // in aip's internal buffer.
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(4 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 32);
  }

  {
    // Need (nextTime - processedTime) = 384 - 384 = 0 frames this round.
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(5 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 32);
  }

  {
    // Need (nextTime - processedTime) = 512 - 384 = 128 frames this round.
    // The Process() aip will take 128 frames from input, packetize and process
    // these frames into floor(128+48/80) = 2 80-frame packet (16 frames left in
    // packetizer), insert packets into aip's internal buffer, then move 128
    // frames the internal buffer to output, leaving 32 + 2*80 - 128 = 64 frames
    // in aip's internal buffer.
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(6 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), nextTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 64);
  }

  aip->SetPassThrough(graph, true);
  {
    // Need (nextTime - processedTime) = 512 - 512 = 0 frames this round.
    // No buffering in pass-through mode
    processedTime = nextTime;
    nextTime = MediaTrackGraphImpl::RoundUpToEndOfAudioBlock(7 * frames);

    AudioSegment input;
    generator.Generate(input, nextTime - processedTime);

    aip->Process(graph, processedTime, nextTime, &input, &output);
    EXPECT_EQ(input.GetDuration(), nextTime - processedTime);
    EXPECT_EQ(output.GetDuration(), processedTime);
    EXPECT_EQ(aip->NumBufferedFrames(graph), 0);
  }

  aip->Stop(graph);
  graph->Destroy();
}
