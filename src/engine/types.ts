export type TrackId = string;

export interface Clip {
  id: string;
  buffer: AudioBuffer;
  beginTime: number; // sec relative to project start
  offsetSec: number; // offset into buffer in sec
  durationSec: number; // duration to play from buffer
  // Optional per-clip playback rate (multiplies with track rate). Defaults to 1.
  playbackRate?: number;
  fadeInSec?: number; // optional fade-in duration in seconds
  fadeOutSec?: number; // optional fade-out duration in seconds
}

export interface Track {
  id: TrackId;
  name: string;
  gain: GainNode;
  pan?: StereoPannerNode;
  muted: boolean;
  solo: boolean;
  playbackRate: number;
  clips: Clip[];
  activeSources: Set<AudioBufferSourceNode>;
  volumeEnvelope?: Array<{ time: number; value: number }>; // [0..2]
}

export interface ExportResult {
  blob: Blob;
  url: string;
  mime: string;
  size: number;
}
