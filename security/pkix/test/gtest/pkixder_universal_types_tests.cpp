/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This code is made available to you under your choice of the following sets
 * of licensing terms:
 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* Copyright 2013 Mozilla Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <limits>
#include <vector>
#include <gtest/gtest.h>

#include "pkix/bind.h"
#include "pkixder.h"
#include "stdint.h"

using namespace mozilla::pkix::der;
using namespace std;

namespace {

class pkixder_universal_types_tests : public ::testing::Test
{
protected:
  virtual void SetUp()
  {
    PR_SetError(0, 0);
  }
};

TEST_F(pkixder_universal_types_tests, BooleanTrue01)
{
  const uint8_t DER_BOOLEAN_TRUE_01[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0x01                        // invalid
  };

  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_BOOLEAN_TRUE_01, sizeof DER_BOOLEAN_TRUE_01));

  bool value = false;
  ASSERT_EQ(Failure, Boolean(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, BooleanTrue42)
{
  const uint8_t DER_BOOLEAN_TRUE_42[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0x42                        // invalid
  };

  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_BOOLEAN_TRUE_42, sizeof DER_BOOLEAN_TRUE_42));

  bool value = false;
  ASSERT_EQ(Failure, Boolean(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

static const uint8_t DER_BOOLEAN_TRUE[] = {
  0x01,                       // BOOLEAN
  0x01,                       // length
  0xff                        // true
};

TEST_F(pkixder_universal_types_tests, BooleanTrueFF)
{
  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_BOOLEAN_TRUE, sizeof DER_BOOLEAN_TRUE));

  bool value = false;
  ASSERT_EQ(Success, Boolean(input, value));
  ASSERT_TRUE(value);
}

TEST_F(pkixder_universal_types_tests, BooleanFalse)
{
  const uint8_t DER_BOOLEAN_FALSE[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0x00                        // false
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_BOOLEAN_FALSE, sizeof DER_BOOLEAN_FALSE));

  bool value = true;
  ASSERT_EQ(Success, Boolean(input, value));
  ASSERT_FALSE(value);
}

TEST_F(pkixder_universal_types_tests, BooleanInvalidLength)
{
  const uint8_t DER_BOOLEAN_INVALID_LENGTH[] = {
    0x01,                       // BOOLEAN
    0x02,                       // length
    0x42, 0x42                  // invalid
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_BOOLEAN_INVALID_LENGTH,
                                sizeof DER_BOOLEAN_INVALID_LENGTH));

  bool value = true;
  ASSERT_EQ(Failure, Boolean(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, BooleanInvalidZeroLength)
{
  const uint8_t DER_BOOLEAN_INVALID_ZERO_LENGTH[] = {
    0x01,                       // BOOLEAN
    0x00                        // length
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_BOOLEAN_INVALID_ZERO_LENGTH,
                                sizeof DER_BOOLEAN_INVALID_ZERO_LENGTH));

  bool value = true;
  ASSERT_EQ(Failure, Boolean(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

// OptionalBoolean implements decoding of OPTIONAL BOOLEAN DEFAULT FALSE.
// If the field is present, it must be a valid encoding of a BOOLEAN with
// value TRUE. If the field is not present, it defaults to FALSE. For
// compatibility reasons, OptionalBoolean can be told to accept an encoding
// where the field is present with value FALSE (this is technically not a
// valid DER encoding).
TEST_F(pkixder_universal_types_tests, OptionalBooleanValidEncodings)
{
  const uint8_t DER_OPTIONAL_BOOLEAN_PRESENT_TRUE[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0xff                        // true
  };

  Input input1;
  ASSERT_EQ(Success, input1.Init(DER_OPTIONAL_BOOLEAN_PRESENT_TRUE,
                                 sizeof DER_OPTIONAL_BOOLEAN_PRESENT_TRUE));
  bool value = false;
  ASSERT_EQ(Success, OptionalBoolean(input1, false, value)) <<
    "Should accept the only valid encoding of a present OPTIONAL BOOLEAN";
  ASSERT_TRUE(value);
  ASSERT_TRUE(input1.AtEnd());

  // The OPTIONAL BOOLEAN is omitted in this data.
  const uint8_t DER_INTEGER_05[] = {
    0x02,                       // INTEGER
    0x01,                       // length
    0x05
  };

  Input input2;
  ASSERT_EQ(Success, input2.Init(DER_INTEGER_05, sizeof DER_INTEGER_05));
  value = true;
  ASSERT_EQ(Success, OptionalBoolean(input2, false, value)) <<
    "Should accept a valid encoding of an omitted OPTIONAL BOOLEAN";
  ASSERT_FALSE(value);
  ASSERT_FALSE(input2.AtEnd());

  Input input3;
  ASSERT_EQ(Success, input3.Init(reinterpret_cast<const uint8_t*>(""), 0));
  value = true;
  ASSERT_EQ(Success, OptionalBoolean(input3, false, value)) <<
    "Should accept another valid encoding of an omitted OPTIONAL BOOLEAN";
  ASSERT_FALSE(value);
  ASSERT_TRUE(input3.AtEnd());
}

TEST_F(pkixder_universal_types_tests, OptionalBooleanInvalidEncodings)
{
  const uint8_t DER_OPTIONAL_BOOLEAN_PRESENT_FALSE[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0x00                        // false
  };

  Input input1;
  ASSERT_EQ(Success, input1.Init(DER_OPTIONAL_BOOLEAN_PRESENT_FALSE,
                                 sizeof DER_OPTIONAL_BOOLEAN_PRESENT_FALSE));
  bool value;
  // If the second parameter to OptionalBoolean is false, invalid encodings
  // that include the field even when it is the DEFAULT FALSE are rejected.
  bool allowInvalidEncodings = false;
  ASSERT_EQ(Failure, OptionalBoolean(input1, allowInvalidEncodings, value)) <<
    "Should reject an invalid encoding of present OPTIONAL BOOLEAN";
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());

  Input input2;
  ASSERT_EQ(Success, input2.Init(DER_OPTIONAL_BOOLEAN_PRESENT_FALSE,
                                 sizeof DER_OPTIONAL_BOOLEAN_PRESENT_FALSE));
  value = true;
  // If the second parameter to OptionalBoolean is true, invalid encodings
  // that include the field even when it is the DEFAULT FALSE are accepted.
  allowInvalidEncodings = true;
  ASSERT_EQ(Success, OptionalBoolean(input2, allowInvalidEncodings, value)) <<
    "Should now accept an invalid encoding of present OPTIONAL BOOLEAN";
  ASSERT_FALSE(value);
  ASSERT_TRUE(input2.AtEnd());

  const uint8_t DER_OPTIONAL_BOOLEAN_PRESENT_42[] = {
    0x01,                       // BOOLEAN
    0x01,                       // length
    0x42                        // (invalid value for a BOOLEAN)
  };

  Input input3;
  ASSERT_EQ(Success, input3.Init(DER_OPTIONAL_BOOLEAN_PRESENT_42,
                                 sizeof DER_OPTIONAL_BOOLEAN_PRESENT_42));
  // Even with the second parameter to OptionalBoolean as true, encodings
  // of BOOLEAN that are invalid altogether are rejected.
  ASSERT_EQ(Failure, OptionalBoolean(input3, allowInvalidEncodings, value)) <<
    "Should reject another invalid encoding of present OPTIONAL BOOLEAN";
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, Enumerated)
{
  const uint8_t DER_ENUMERATED[] = {
    0x0a,                       // ENUMERATED
    0x01,                       // length
    0x42                        // value
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_ENUMERATED, sizeof DER_ENUMERATED));

  uint8_t value = 0;
  ASSERT_EQ(Success, Enumerated(input, value));
  ASSERT_EQ(0x42, value);
}

TEST_F(pkixder_universal_types_tests, EnumeratedNotShortestPossibleDER)
{
  const uint8_t DER_ENUMERATED[] = {
    0x0a,                       // ENUMERATED
    0x02,                       // length
    0x00, 0x01                  // value
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_ENUMERATED, sizeof DER_ENUMERATED));
  uint8_t value = 0;
  ASSERT_EQ(Failure, Enumerated(input, value));
}

TEST_F(pkixder_universal_types_tests, EnumeratedOutOfAcceptedRange)
{
  // Although this is a valid ENUMERATED value according to ASN.1, we
  // intentionally don't support these large values because there are no
  // ENUMERATED values in X.509 certs or OCSP this large, and we're trying to
  // keep the parser simple and fast.
  const uint8_t DER_ENUMERATED_INVALID_LENGTH[] = {
    0x0a,                       // ENUMERATED
    0x02,                       // length
    0x12, 0x34                  // value
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_ENUMERATED_INVALID_LENGTH,
                                sizeof DER_ENUMERATED_INVALID_LENGTH));

  uint8_t value = 0;
  ASSERT_EQ(Failure, Enumerated(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, EnumeratedInvalidZeroLength)
{
  const uint8_t DER_ENUMERATED_INVALID_ZERO_LENGTH[] = {
    0x0a,                       // ENUMERATED
    0x00                        // length
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_ENUMERATED_INVALID_ZERO_LENGTH,
                                sizeof DER_ENUMERATED_INVALID_ZERO_LENGTH));

  uint8_t value = 0;
  ASSERT_EQ(Failure, Enumerated(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

static PRTime
YMDHMS(int16_t year, int16_t month, int16_t day,
       int16_t hour, int16_t minutes, int16_t seconds)
{
  PRExplodedTime tm;
  tm.tm_usec = 0;
  tm.tm_sec = seconds;
  tm.tm_min = minutes;
  tm.tm_hour = hour;
  tm.tm_mday = day;
  tm.tm_month = month - 1; // tm_month is zero-based
  tm.tm_year = year;
  tm.tm_params.tp_gmt_offset = 0;
  tm.tm_params.tp_dst_offset = 0;
  return PR_ImplodeTime(&tm);
}

////////////////////////////////////////
// GeneralizedTime and TimeChoice
//
// From RFC 5280 section 4.1.2.5.2
//
//   For the purposes of this profile, GeneralizedTime values MUST be
//   expressed in Greenwich Mean Time (Zulu) and MUST include seconds
//   (i.e., times are YYYYMMDDHHMMSSZ), even where the number of seconds
//   is zero.  GeneralizedTime values MUST NOT include fractional seconds.
//
// And from from RFC 6960 (OCSP) section 4.2.2.1:
//
//   Responses can contain four times -- thisUpdate, nextUpdate,
//   producedAt, and revocationTime.  The semantics of these fields are
//   defined in Section 2.4.  The format for GeneralizedTime is as
//   specified in Section 4.1.2.5.2 of [RFC5280].
//
// So while we can could accept other ASN1 (ITU-T X.680) encodings for
// GeneralizedTime we should not accept them, and breaking reading of these
// other encodings is actually encouraged.

// Given a DER-encoded GeneralizedTime where we want to extract the value, we
// need to skip two bytes: the tag and the length.
static const uint16_t GT_VALUE_OFFSET = 2;

// Given a DER-encoded GeneralizedTime where we want to extract the value as
// though it were a UTC time, we need to skip four bytes: the tag, the length
// and the first two digits of the year.
static const uint16_t UTC_VALUE_OFFSET = 4;

static const uint16_t GENERALIZED_TIME_LENGTH = 17; // tvYYYYMMDDHHMMSSZ

template <uint16_t LENGTH>
void
ExpectGoodTime(PRTime expectedValue,
               const uint8_t (&generalizedTimeDER)[LENGTH])
{
  static_assert(LENGTH >= UTC_VALUE_OFFSET,
                "ExpectGoodTime requires input at least UTC_VALUE_OFFSET bytes");

  // GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success, input.Init(generalizedTimeDER, LENGTH));
    PRTime value = 0;
    ASSERT_EQ(Success, GeneralizedTime(input, value));
    EXPECT_EQ(expectedValue, value);
  }

  // TimeChoice: GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success, input.Init(generalizedTimeDER + GT_VALUE_OFFSET,
                                  LENGTH - GT_VALUE_OFFSET));
    PRTime value = 0;
    ASSERT_EQ(Success, TimeChoice(siGeneralizedTime, input, value));
    EXPECT_EQ(expectedValue, value);
  }

  // TimeChoice: UTCTime
  {
    Input input;
    ASSERT_EQ(Success, input.Init(generalizedTimeDER + UTC_VALUE_OFFSET,
                                  LENGTH - UTC_VALUE_OFFSET));
    PRTime value = 0;
    ASSERT_EQ(Success, TimeChoice(siUTCTime, input, value));
    EXPECT_EQ(expectedValue, value);
  }
}

template <uint16_t LENGTH>
void
ExpectBadTime(const uint8_t (&generalizedTimeDER)[LENGTH])
{
  static_assert(LENGTH >= UTC_VALUE_OFFSET,
                "ExpectBadTime requires input at least UTC_VALUE_OFFSET bytes");


  // GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success, input.Init(generalizedTimeDER, LENGTH));
    PRTime value;
    ASSERT_EQ(Failure, GeneralizedTime(input, value));
    EXPECT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
  }

  // TimeChoice: GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success,
              input.Init(generalizedTimeDER + GT_VALUE_OFFSET,
                         LENGTH - GT_VALUE_OFFSET));
    PRTime value;
    ASSERT_EQ(Failure, TimeChoice(siGeneralizedTime, input, value));
    EXPECT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
  }

  // TimeChoice: UTCTime
  {
    Input input;
    ASSERT_EQ(Success,
              input.Init(generalizedTimeDER + UTC_VALUE_OFFSET,
                         LENGTH - UTC_VALUE_OFFSET));
    PRTime value;
    ASSERT_EQ(Failure, TimeChoice(siUTCTime, input, value));
    EXPECT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
  }
}

// Control value: a valid time
TEST_F(pkixder_universal_types_tests, ValidControl)
{
  const uint8_t GT_DER[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', '0', '5', '0', '6', '1', '6', '4', '5', '4', '0', 'Z'
  };
  ExpectGoodTime(YMDHMS(1991, 5, 6, 16, 45, 40), GT_DER);
}

TEST_F(pkixder_universal_types_tests, TimeTimeZoneOffset)
{
  const uint8_t DER_GENERALIZED_TIME_OFFSET[] = {
    0x18,                           // Generalized Time
    19,                             // Length = 19
    '1', '9', '9', '1', '0', '5', '0', '6', '1', '6', '4', '5', '4', '0', '-',
    '0', '7', '0', '0'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_OFFSET);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidZeroLength)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_ZERO_LENGTH[] = {
    0x18,                           // GeneralizedTime
    0x00                            // Length = 0
  };

  PRTime value;

  // GeneralizedTime
  Input gt;
  ASSERT_EQ(Success,
            gt.Init(DER_GENERALIZED_TIME_INVALID_ZERO_LENGTH,
                    sizeof DER_GENERALIZED_TIME_INVALID_ZERO_LENGTH));
  ASSERT_EQ(Failure, GeneralizedTime(gt, value));
  ASSERT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());

  static const uint8_t dummy[1] = { 'X' };

  // TimeChoice: GeneralizedTime
  Input tc_gt;
  ASSERT_EQ(Success, tc_gt.Init(dummy, 0));
  ASSERT_EQ(Failure, TimeChoice(siGeneralizedTime, tc_gt, value));
  ASSERT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());

  // TimeChoice: UTCTime
  Input tc_utc;
  ASSERT_EQ(Success, tc_utc.Init(dummy, 0));
  ASSERT_EQ(Failure, TimeChoice(siUTCTime, tc_utc, value));
  ASSERT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
}

// A non zulu time should fail
TEST_F(pkixder_universal_types_tests, TimeInvalidLocal)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_LOCAL[] = {
    0x18,                           // Generalized Time
    14,                             // Length = 14
    '1', '9', '9', '1', '0', '5', '0', '6', '1', '6', '4', '5', '4', '0'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_LOCAL);
}

// A time missing seconds and zulu should fail
TEST_F(pkixder_universal_types_tests, TimeInvalidTruncated)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_TRUNCATED[] = {
    0x18,                           // Generalized Time
    12,                             // Length = 12
    '1', '9', '9', '1', '0', '5', '0', '6', '1', '6', '4', '5'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_TRUNCATED);
}

TEST_F(pkixder_universal_types_tests, GeneralizedTimeNoSeconds)
{
  const uint8_t DER_GENERALIZED_TIME_NO_SECONDS[] = {
    0x18,                           // Generalized Time
    13,                             // Length = 13
    '1', '9', '9', '1', '0', '5', '0', '6', '1', '6', '4', '5', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_NO_SECONDS);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidPrefixedYear)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_PREFIXED_YEAR[] = {
    0x18,                           // Generalized Time
    16,                             // Length = 16
    ' ', '1', '9', '9', '1', '0', '1', '0', '1', '0', '1', '0', '1', '0', '1', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_PREFIXED_YEAR);
}

TEST_F(pkixder_universal_types_tests, TimeTooManyDigits)
{
  const uint8_t DER_GENERALIZED_TIME_TOO_MANY_DIGITS[] = {
    0x18,                           // Generalized Time
    16,                             // Length = 16
    '1', '1', '1', '1', '1', '0', '1', '0', '1', '0', '1', '0', '1', '0', '1', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_TOO_MANY_DIGITS);
}

TEST_F(pkixder_universal_types_tests, Time13thMonth)
{
  const uint8_t DER_GENERALIZED_TIME_13TH_MONTH[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', //YYYY (1991)
    '1', '3', //MM 13th month of the year
    '0', '6', '1', '6', '4', '5', '4', '0', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_13TH_MONTH);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidDayFeb)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_DAY_FEB[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', // YYYY 1991
    '0', '2', // MM (February)
    '3', '0', // DD (the 30th which does not exist)
    '1', '6', '4', '5', '4', '0', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_DAY_FEB);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidDayDec)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_DAY_DEC[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', // YYYY 1991
    '1', '2', // MM (December)
    '3', '2', // DD (the 32nd which does not exist)
    '1', '6', '4', '5', '4', '0', 'Z'
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_DAY_DEC);
}

TEST_F(pkixder_universal_types_tests, TimeLeapSecondJune)
{
  // No leap seconds ever (allowing them would be non-trivial).
  const uint8_t DER_GENERALIZED_TIME_LEAP_SECOND_JUNE[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '3', '5', '9', '6', '0', 'Z' // HHMMSSZ (23:59:60 Zulu)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_LEAP_SECOND_JUNE);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidHours)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_HOURS[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '5', '5', '9', '0', '1', 'Z' // HHMMSSZ (!!25!!:59:01 Zulu)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_HOURS);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidMinutes)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_MINUTES[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '3', '6', '0', '5', '9', 'Z' // HHMMSSZ (23:!!!60!!!:01 Zulu)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_MINUTES);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidSeconds)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_SECONDS[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '3', '5', '9', '6', '1', 'Z' // HHMMSSZ (23:59:!!!!61!!!! Zulu)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_SECONDS);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidZulu)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_ZULU[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '3', '5', '9', '5', '9', 'z' // HHMMSSZ (23:59:59 !!!z!!!) should be Z
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_ZULU);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidExtraData)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_EXTRA_DATA[] = {
    0x18,                           // Generalized Time
    16,                             // Length = 16
    '2', '0', '1', '2', '0', '6', '3', '0', // YYYYMMDD (2012-06-30)
    '2', '3', '5', '9', '5', '9', 'Z', // HHMMSSZ (23:59:59Z)
    0 // Extra null character
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_EXTRA_DATA);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidCenturyChar)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_CENTURY_CHAR[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    'X', '9', '9', '1', '1', '2', '0', '6', // YYYYMMDD (X991-12-06)
    '1', '6', '4', '5', '4', '0', 'Z' // HHMMSSZ (16:45:40Z)
  };

  // We can't use ExpectBadTime here, because ExpectBadTime requires
  // consistent results for GeneralizedTime and UTCTime, but the results
  // for this input are different.

  // GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success,
              input.Init(DER_GENERALIZED_TIME_INVALID_CENTURY_CHAR,
                         sizeof DER_GENERALIZED_TIME_INVALID_CENTURY_CHAR));
    PRTime value = 0;
    ASSERT_EQ(Failure, GeneralizedTime(input, value));
    EXPECT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
  }

  // TimeChoice: GeneralizedTime
  {
    Input input;
    ASSERT_EQ(Success,
              input.Init(DER_GENERALIZED_TIME_INVALID_CENTURY_CHAR,
                         sizeof DER_GENERALIZED_TIME_INVALID_CENTURY_CHAR));
    PRTime value = 0;
    ASSERT_EQ(Failure, TimeChoice(siGeneralizedTime, input, value));
    EXPECT_EQ(SEC_ERROR_INVALID_TIME, PR_GetError());
  }

  // This test is not applicable to TimeChoice: UTCTime
}

TEST_F(pkixder_universal_types_tests, TimeInvalidYearChar)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_YEAR_CHAR[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', 'I', '0', '1', '0', '6', // YYYYMMDD (199I-12-06)
    '1', '6', '4', '5', '4', '0', 'Z' // HHMMSSZ (16:45:40Z)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_YEAR_CHAR);
}

TEST_F(pkixder_universal_types_tests, GeneralizedTimeInvalidMonthChar)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_MONTH_CHAR[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', '0', 'I', '0', '6', // YYYYMMDD (1991-0I-06)
    '1', '6', '4', '5', '4', '0', 'Z' // HHMMSSZ (16:45:40Z)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_MONTH_CHAR);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidDayChar)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_DAY_CHAR[] = {
    0x18,                           // Generalized Time
    15,                             // Length = 15
    '1', '9', '9', '1', '0', '1', '0', 'S', // YYYYMMDD (1991-01-0S)
    '1', '6', '4', '5', '4', '0', 'Z' // HHMMSSZ (16:45:40Z)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_DAY_CHAR);
}

TEST_F(pkixder_universal_types_tests, TimeInvalidFractionalSeconds)
{
  const uint8_t DER_GENERALIZED_TIME_INVALID_FRACTIONAL_SECONDS[] = {
    0x18,                           // Generalized Time
    17,                             // Length = 17
    '1', '9', '9', '1', '0', '1', '0', '1', // YYYYMMDD (1991-01-01)
    '1', '6', '4', '5', '4', '0', '.', '3', 'Z' // HHMMSS.FFF (16:45:40.3Z)
  };
  ExpectBadTime(DER_GENERALIZED_TIME_INVALID_FRACTIONAL_SECONDS);
}

TEST_F(pkixder_universal_types_tests, Integer_0_127)
{
  for (uint8_t i = 0; i <= 127; ++i) {
    const uint8_t DER[] = {
      0x02, // INTEGER
      0x01, // length
      i,    // value
    };

    Input input;
    ASSERT_EQ(Success, input.Init(DER, sizeof DER));

    uint8_t value = i + 1; // initialize with a value that is NOT i.
    ASSERT_EQ(Success, Integer(input, value));
    ASSERT_EQ(i, value);
  }
}

TEST_F(pkixder_universal_types_tests, Integer_Negative1)
{
  // This is a valid integer value but our integer parser cannot parse
  // negative values.

  static const uint8_t DER[] = {
    0x02, // INTEGER
    0x01, // length
    0xff, // -1 (two's complement)
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER, sizeof DER));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, Integer_Negative128)
{
  // This is a valid integer value but our integer parser cannot parse
  // negative values.

  static const uint8_t DER[] = {
    0x02, // INTEGER
    0x01, // length
    0x80, // -128 (two's complement)
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER, sizeof DER));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, Integer_128)
{
  // This is a valid integer value but our integer parser cannot parse
  // values that require more than one byte to encode.

  static const uint8_t DER[] = {
    0x02, // INTEGER
    0x02, // length
    0x00, 0x80 // 128
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER, sizeof DER));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, Integer11223344)
{
  // This is a valid integer value but our integer parser cannot parse
  // values that require more than one byte to be encoded.

  static const uint8_t DER[] = {
    0x02,                       // INTEGER
    0x04,                       // length
    0x11, 0x22, 0x33, 0x44      // 0x11223344
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER, sizeof DER));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, IntegerTruncatedOneByte)
{
  const uint8_t DER_INTEGER_TRUNCATED[] = {
    0x02,                       // INTEGER
    0x01,                       // length
    // MISSING DATA HERE
  };

  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_INTEGER_TRUNCATED, sizeof DER_INTEGER_TRUNCATED));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, IntegerTruncatedLarge)
{
  const uint8_t DER_INTEGER_TRUNCATED[] = {
    0x02,                       // INTEGER
    0x04,                       // length
    0x11, 0x22                  // 0x1122
    // MISSING DATA HERE
  };

  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_INTEGER_TRUNCATED, sizeof DER_INTEGER_TRUNCATED));

  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, IntegerZeroLength)
{
  const uint8_t DER_INTEGER_ZERO_LENGTH[] = {
    0x02,                       // INTEGER
    0x00                        // length
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_INTEGER_ZERO_LENGTH,
                                sizeof DER_INTEGER_ZERO_LENGTH));
  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, IntegerOverlyLong1)
{
  const uint8_t DER_INTEGER_OVERLY_LONG1[] = {
    0x02,                       // INTEGER
    0x02,                       // length
    0x00, 0x01                  //
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_INTEGER_OVERLY_LONG1,
                                sizeof DER_INTEGER_OVERLY_LONG1));
  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, IntegerOverlyLong2)
{
  const uint8_t DER_INTEGER_OVERLY_LONG2[] = {
    0x02,                       // INTEGER
    0x02,                       // length
    0xff, 0x80                  //
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_INTEGER_OVERLY_LONG2,
                                sizeof DER_INTEGER_OVERLY_LONG2));
  uint8_t value;
  ASSERT_EQ(Failure, Integer(input, value));
  ASSERT_EQ(SEC_ERROR_BAD_DER, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, OptionalIntegerSupportedDefault)
{
  // The input is a BOOLEAN and not INTEGER for the input so we'll not parse
  // anything and instead use the default value.
  Input input;
  ASSERT_EQ(Success, input.Init(DER_BOOLEAN_TRUE, sizeof DER_BOOLEAN_TRUE));
  long value = 1;
  ASSERT_EQ(Success, OptionalInteger(input, -1, value));
  ASSERT_EQ(-1, value);
  bool boolValue;
  ASSERT_EQ(Success, Boolean(input, boolValue));
}

TEST_F(pkixder_universal_types_tests, OptionalIntegerUnsupportedDefault)
{
  // The same as the previous test, except with an unsupported default value
  // passed in.
  Input input;
  ASSERT_EQ(Success, input.Init(DER_BOOLEAN_TRUE, sizeof DER_BOOLEAN_TRUE));
  long value;
  ASSERT_EQ(Failure, OptionalInteger(input, 0, value));
  ASSERT_EQ(SEC_ERROR_INVALID_ARGS, PR_GetError());
}

TEST_F(pkixder_universal_types_tests, OptionalIntegerSupportedDefaultAtEnd)
{
  static const uint8_t dummy = 1;

  Input input;
  ASSERT_EQ(Success, input.Init(&dummy, 0));
  long value = 1;
  ASSERT_EQ(Success, OptionalInteger(input, -1, value));
  ASSERT_EQ(-1, value);
}

TEST_F(pkixder_universal_types_tests, OptionalIntegerNonDefaultValue)
{
  static const uint8_t DER[] = {
    0x02, // INTEGER
    0x01, // length
    0x00
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER, sizeof DER));
  long value = 2;
  ASSERT_EQ(Success, OptionalInteger(input, -1, value));
  ASSERT_EQ(0, value);
  ASSERT_TRUE(input.AtEnd());
}

TEST_F(pkixder_universal_types_tests, Null)
{
  const uint8_t DER_NUL[] = {
    0x05,
    0x00
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_NUL, sizeof DER_NUL));
  ASSERT_EQ(Success, Null(input));
}

TEST_F(pkixder_universal_types_tests, NullWithBadLength)
{
  const uint8_t DER_NULL_BAD_LENGTH[] = {
    0x05,
    0x01,
    0x00
  };

  Input input;
  ASSERT_EQ(Success,
            input.Init(DER_NULL_BAD_LENGTH, sizeof DER_NULL_BAD_LENGTH));

  ASSERT_EQ(Failure, Null(input));
}

TEST_F(pkixder_universal_types_tests, OID)
{
  const uint8_t DER_VALID_OID[] = {
    0x06,
    0x09,
    0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x30, 0x01, 0x01
  };

  Input input;
  ASSERT_EQ(Success, input.Init(DER_VALID_OID, sizeof DER_VALID_OID));

  const uint8_t expectedOID[] = {
    0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x30, 0x01, 0x01
  };

  ASSERT_EQ(Success, OID(input, expectedOID));
}

} // unnamed namespace
