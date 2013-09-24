/* -*- Mode: IDL; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * The origin of this IDL file is
 * https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
 *
 * Copyright © 2012 W3C® (MIT, ERCIM, Keio), All Rights Reserved. W3C
 * liability, trademark and document use rules apply.
 */

[PrefControlled]
interface AudioBufferSourceNode : AudioNode {

    attribute AudioBuffer? buffer;

    readonly attribute AudioParam playbackRate;

    attribute boolean loop;
    attribute double loopStart;
    attribute double loopEnd;

    [Throws]
    void start(optional double when = 0, optional double grainOffset = 0,
               optional double grainDuration);
    [Throws]
    void stop(optional double when = 0);

    attribute EventHandler onended;
};

/*
 * The origin of this IDL file is
 * https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AlternateNames
 */
[PrefControlled]
partial interface AudioBufferSourceNode {
    // Same as start()
    [Throws,Pref="media.webaudio.legacy.AudioBufferSourceNode"]
    void noteOn(double when);
    [Throws,Pref="media.webaudio.legacy.AudioBufferSourceNode"]
    void noteGrainOn(double when, double grainOffset, double grainDuration);
    
    [Throws,Pref="media.webaudio.legacy.AudioBufferSourceNode"]
    // Same as stop()
    void noteOff(double when);
};

