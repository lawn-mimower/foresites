import React, { useRef } from 'react';
import { CollapsibleSection } from '../CollapsibleSection';

const ICON_AUDIO = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>';

const WAVE_HEIGHTS = [30,50,70,40,80,60,90,45,70,55,80,65,35,75,50,85,40,60,70,50,40,65,80,30];

export default function AudioReportSection({ snag, defaultOpen = false }) {
  const audioRef = useRef(null);
  const hasAudio = snag.feedback_type === 'voice' && snag.voice_url;

  const audioBadge = hasAudio
    ? { text: 'Recording available', cls: 'has-content' }
    : { text: 'No recording', cls: '' };

  const playAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play(); else audio.pause();
  };

  return (
    <CollapsibleSection
      title="Audio Report"
      icon={ICON_AUDIO}
      badge={audioBadge.text}
      badgeClass={audioBadge.cls}
      defaultOpen={defaultOpen}
    >
      {hasAudio ? (
        <>
          <div className="audio-player">
            <button className="audio-play-btn" onClick={playAudio}>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div className="audio-waveform">
              {WAVE_HEIGHTS.map((h, i) => (
                <div key={i} className={`wave-bar${i < 8 ? ' played' : ''}`} style={{ height: `${h}%` }} />
              ))}
            </div>
            <span className="audio-dur">—:——</span>
          </div>
          <audio ref={audioRef} src={snag.voice_url} preload="none" />
          {snag.transcription ? (
            <div className="transcription-box">{snag.transcription}</div>
          ) : (
            <div className="transcription-box none">Transcription processing…</div>
          )}
        </>
      ) : (
        <div className="audio-none">
          <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
          No audio recorded
        </div>
      )}
    </CollapsibleSection>
  );
}
