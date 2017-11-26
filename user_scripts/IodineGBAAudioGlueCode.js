"use strict";
/*
 Copyright (C) 2012-2014 Grant Galitz
 
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
var GlueCodeMixer=function(){
    var thiss=(new audioInit()).GlueCodeMixer;
    var parentObj = thiss;
    thiss.audio = new XAudioServer(2, thiss.sampleRate, 0, thiss.bufferAmount, null, 1, function () {
      parentObj.audio=null;
    });
    thiss.outputUnits = [];
    thiss.outputUnitsValid = [];
    setInterval(function(){parentObj.checkAudio();}, 16);
    thiss.initializeBuffer();
}
var GlueCodeMixerInput=function(mixer){
 var thiss=(new audioInit()).GlueCodeMixerInput;
 thiss.mixer=mixer;
}
var AudioBufferWrapper=function(channelCount,mixerChannelCount,bufferAmount,sampleRate,mixerSampleRate){
    var thiss=(new audioInit()).AudioBufferWrapper;
    thiss.channelCount = channelCount;
    thiss.mixerChannelCount = mixerChannelCount;
    thiss.bufferAmount = bufferAmount;
    thiss.sampleRate = sampleRate;
    thiss.mixerSampleRate = mixerSampleRate;
    thiss.initialize();
}
var AudioSimpleBuffer=function(channelCount,bufferAmount){
    var thiss=(new audioInit()).AudioSimpleBuffer;
    thiss.channelCount = channelCount;
    thiss.bufferAmount = bufferAmount;
    thiss.outBufferSize = thiss.channelCount * thiss.bufferAmount;
    thiss.stackLength = 0;
    thiss.buffer = getFloat32Array(thiss.outBufferSize);
}
function audioInit(GlueCodeMixer,GlueCodeMixerInput,AudioBufferWrapper,AudioSimpleBuffer){
this.GlueCodeMixer=GlueCodeMixer;
this.GlueCodeMixerInput=GlueCodeMixerInput;
this.AudioBufferWrapper=AudioBufferWrapper;
this.AudioSimpleBuffer=AudioSimpleBuffer;

this.GlueCodeMixer.sampleRate = 44100;
this.GlueCodeMixer.bufferAmount = 44100;
this.GlueCodeMixer.channelCount = 2;
this.GlueCodeMixer.initializeBuffer = function () {
    this.buffer = new AudioSimpleBuffer(this.channelCount,
                                         this.bufferAmount);
}
this.GlueCodeMixer.appendInput = function (inUnit) {
    if (this.audio) {
        for (var index = 0; index < this.outputUnits.length; index++) {
            if (!this.outputUnits[index]) {
                break;
            }
        }
        this.outputUnits[index] = inUnit;
        this.outputUnitsValid.push(inUnit);
        inUnit.registerStackPosition(index);
    }
    else if (typeof inUnit.errorCallback == "function") {
        inUnit.errorCallback();
    }
}
this.GlueCodeMixer.unregister=GlueCodeMixer.prototype.unregister = function (stackPosition) {
    this.outputUnits[stackPosition] = null;
    this.outputUnitsValid = [];
    for (var index = 0, length = this.outputUnits.length; index < length; ++index) {
        if (this.outputUnits[index]) {
            this.outputUnitsValid.push(this.outputUnits);
        }
    }
}
this.GlueCodeMixer.checkAudio=GlueCodeMixer.prototype.checkAudio = function () {
    if (this.audio) {
        var inputCount = this.outputUnitsValid.length;
        for (var inputIndex = 0, output = 0; inputIndex < inputCount; ++inputIndex) {
            this.outputUnitsValid[inputIndex].prepareShift();
        }
        for (var count = 0, requested = this.findLowestBufferCount(); count < requested; ++count) {
            for (var inputIndex = 0, output = 0; inputIndex < inputCount; ++inputIndex) {
                output += this.outputUnitsValid[inputIndex].shift();
            }
            this.buffer.push(output);
        }
        this.audio.writeAudioNoCallback(this.buffer.getSlice());
    }
}
this.GlueCodeMixer.findLowestBufferCount=GlueCodeMixer.prototype.findLowestBufferCount = function () {
    var count = 0;
    for (var inputIndex = 0, inputCount = this.outputUnitsValid.length; inputIndex < inputCount; ++inputIndex) {
        var tempCount = this.outputUnitsValid[inputIndex].buffer.remainingBuffer();
        if (tempCount > 0) {
            if (count > 0) {
                count = Math.min(count, tempCount);
            }
            else {
                count = tempCount;
            }
        }
    }
    return count;
}
this.GlueCodeMixer.disableAudio=GlueCodeMixer.prototype.disableAudio = function () {this.audio = null;}
this.GlueCodeMixerInput.initialize=GlueCodeMixerInput.prototype.initialize = function (channelCount, sampleRate, bufferAmount, startingVolume, errorCallback) {
    this.channelCount = channelCount;
    this.sampleRate = sampleRate;
    this.bufferAmount = bufferAmount;
    this.volume = startingVolume;
    this.errorCallback = errorCallback;
    this.buffer = new AudioBufferWrapper(this.channelCount,
                                         this.mixer.channelCount,
                                         this.bufferAmount,
                                         this.sampleRate,
                                         this.mixer.sampleRate);
    
}
this.GlueCodeMixerInput.register=GlueCodeMixerInput.prototype.register = function (volume) {
    this.mixer.appendInput(this);
}
this.GlueCodeMixerInput.changeVolume=GlueCodeMixerInput.prototype.changeVolume = function (volume) {
    this.volume = volume;
}
this.GlueCodeMixerInput.prepareShift=GlueCodeMixerInput.prototype.prepareShift = function () {
    this.buffer.resampleRefill();
}
this.GlueCodeMixerInput.shift=GlueCodeMixerInput.prototype.shift = function () {
    return this.buffer.shift() * this.volume;
}
this.GlueCodeMixerInput.push=GlueCodeMixerInput.prototype.push = function (buffer) {
    this.buffer.push(buffer);
    this.mixer.checkAudio();
}
this.GlueCodeMixerInput.remainingBuffer=GlueCodeMixerInput.prototype.remainingBuffer = function () {
    return this.buffer.remainingBuffer() + (Math.floor((this.mixer.audio.remainingBuffer() * this.sampleRate / this.mixer.sampleRate) / this.mixer.channelCount) * this.mixer.channelCount);
}
this.GlueCodeMixerInput.registerStackPosition=GlueCodeMixerInput.prototype.registerStackPosition = function (stackPosition) {
    this.stackPosition = stackPosition;
}
this.GlueCodeMixerInput.unregister=GlueCodeMixerInput.prototype.unregister = function () {
    this.mixer.unregister(this.stackPosition);
}
this.AudioBufferWrapper.initialize=AudioBufferWrapper.prototype.initialize = function () {
    this.inBufferSize = this.bufferAmount * this.mixerChannelCount;
    this.inBuffer = getFloat32Array(this.inBufferSize);
    this.outBufferSize = (Math.ceil(this.inBufferSize * this.mixerSampleRate / this.sampleRate / this.mixerChannelCount) * this.mixerChannelCount) + this.mixerChannelCount;
    this.outBuffer = getFloat32Array(this.outBufferSize);
    this.resampler = new Resampler(this.sampleRate, this.mixerSampleRate, this.mixerChannelCount, this.outBufferSize, true);
    this.inputOffset = 0;
    this.resampleBufferStart = 0;
    this.resampleBufferEnd = 0;
}
this.AudioBufferWrapper.push=AudioBufferWrapper.prototype.push = function (buffer) {
    var length  = buffer.length;
    if (this.channelCount < this.mixerChannelCount) {
        for (var bufferCounter = 0; bufferCounter < length && this.inputOffset < this.inBufferSize;) {
            for (var index = this.channelCount; index < this.mixerChannelCount; ++index) {
                this.inBuffer[this.inputOffset++] = buffer[bufferCounter];
            }
            for (index = 0; index < this.channelCount && bufferCounter < length; ++index) {
                this.inBuffer[this.inputOffset++] = buffer[bufferCounter++];
            }
        }
    }
    else if (this.channelCount == this.mixerChannelCount) {
        for (var bufferCounter = 0; bufferCounter < length && this.inputOffset < this.inBufferSize;) {
            this.inBuffer[this.inputOffset++] = buffer[bufferCounter++];
        }
    }
    else {
        for (var bufferCounter = 0; bufferCounter < length && this.inputOffset < this.inBufferSize;) {
            for (index = 0; index < this.mixerChannelCount && bufferCounter < length; ++index) {
                this.inBuffer[this.inputOffset++] = buffer[bufferCounter++];
            }
            bufferCounter += this.channelCount - this.mixerChannelCount;
        }
    }
}
this.AudioBufferWrapper.shift=AudioBufferWrapper.prototype.shift = function () {
    var output = 0;
    if (this.resampleBufferStart != this.resampleBufferEnd) {
        output = this.outBuffer[this.resampleBufferStart++];
        if (this.resampleBufferStart == this.outBufferSize) {
            this.resampleBufferStart = 0;
        }
    }
    return output;
}
this.AudioBufferWrapper.resampleRefill=AudioBufferWrapper.prototype.resampleRefill = function () {
    if (this.inputOffset > 0) {
        //Resample a chunk of audio:
        var resampleLength = this.resampler.resampler(this.getSlice(this.inBuffer, this.inputOffset));
        var resampledResult = this.resampler.outputBuffer;
        for (var index2 = 0; index2 < resampleLength;) {
            this.outBuffer[this.resampleBufferEnd++] = resampledResult[index2++];
            if (this.resampleBufferEnd == this.outBufferSize) {
                this.resampleBufferEnd = 0;
            }
            if (this.resampleBufferStart == this.resampleBufferEnd) {
                this.resampleBufferStart += this.mixerChannelCount;
                if (this.resampleBufferStart == this.outBufferSize) {
                    this.resampleBufferStart = 0;
                }
            }
        }
        this.inputOffset = 0;
    }
}
this.AudioBufferWrapper.remainingBuffer=AudioBufferWrapper.prototype.remainingBuffer = function () {
    return (Math.floor((this.resampledSamplesLeft() * this.resampler.ratioWeight) / this.mixerChannelCount) * this.mixerChannelCount) + this.inputOffset;
}
this.AudioBufferWrapper.resampledSamplesLeft=AudioBufferWrapper.prototype.resampledSamplesLeft = function () {
    return ((this.resampleBufferStart <= this.resampleBufferEnd) ? 0 : this.outBufferSize) + this.resampleBufferEnd - this.resampleBufferStart;
}
this.AudioBufferWrapper.getSlice=AudioBufferWrapper.prototype.getSlice = function (buffer, lengthOf) {
    //Typed array and normal array buffer section referencing:
    try {
        return buffer.subarray(0, lengthOf);
    }
    catch (error) {
        try {
            //Regular array pass:
            buffer.length = lengthOf;
            return buffer;
        }
        catch (error) {
            //Nightly Firefox 4 used to have the subarray function named as slice:
            return buffer.slice(0, lengthOf);
        }
    }
}
this.AudioSimpleBuffer.push=AudioSimpleBuffer.prototype.push = function (data) {
    if (this.stackLength < this.outBufferSize) {
        this.buffer[this.stackLength++] = data;
    }
}
this.AudioSimpleBuffer.getSlice=AudioSimpleBuffer.prototype.getSlice = function () {
    var lengthOf = this.stackLength;
    this.stackLength = 0;
    //Typed array and normal array buffer section referencing:
    try {
        return this.buffer.subarray(0, lengthOf);
    }
    catch (error) {
        try {
            //Regular array pass:
            this.buffer.length = lengthOf;
            return this.buffer;
        }
        catch (error) {
            //Nightly Firefox 4 used to have the subarray function named as slice:
            return this.buffer.slice(0, lengthOf);
        }
    }
}
}
audioInit((new GlueCodeMixer()),(new GlueCodeMixerInput()),(new AudioBufferWrapper()),(new AudioSimpleBuffer()));
