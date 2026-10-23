import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { Mic, MicOff, Volume2, VolumeX, Radio, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const LiveVoiceChatWidget: React.FC = () => {
  const { activeMatch, user, sendP2pVoiceSignal } = useGame();

  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);

  const isP2PMatch = Boolean(activeMatch && activeMatch.isVsAi === false && activeMatch.roomCode && activeMatch.status !== 'completed');
  const opponentName = activeMatch?.opponent?.displayName || activeMatch?.opponent?.username || 'Opponent';

  // Clean up WebRTC peer connection & media streams
  const cleanupVoiceChat = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsMicOn(false);
    setIsLocalSpeaking(false);
    setIsRemoteSpeaking(false);
  }, []);

  // Initialize WebRTC Peer Connection
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    // Send local ICE candidates to opponent
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendP2pVoiceSignal({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    // Attach remote stream to hidden audio element
    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
        setConnectionStatus('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setErrorMessage(null);
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    };

    return pc;
  }, [sendP2pVoiceSignal]);

  // Request Microphone Access & Start Local Audio Stream
  const startMicrophone = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      // Setup Web Audio API Volume Analyser
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          localAnalyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!localAnalyserRef.current) return;
            localAnalyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setIsLocalSpeaking(avg > 25);
            if (localStreamRef.current) {
              requestAnimationFrame(checkVolume);
            }
          };
          checkVolume();
        }
      } catch {
        // AudioContext optional fallback
      }

      return stream;
    } catch (err: any) {
      console.warn('Microphone access denied:', err);
      setErrorMessage('Microphone access denied. Enable mic permissions to voice chat.');
      setConnectionStatus('error');
      return null;
    }
  };

  // Toggle Microphone On / Off
  const toggleMic = async () => {
    sound.playClick();
    telegram.triggerHaptic('light');

    if (!isMicOn) {
      setConnectionStatus('connecting');
      const stream = await startMicrophone();
      if (!stream) return;

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      setIsMicOn(true);
      setErrorMessage(null);

      // Create and send SDP Offer if Host
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendP2pVoiceSignal({
          type: 'offer',
          offer,
        });
      } catch (err) {
        console.warn('Error creating WebRTC offer:', err);
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsMicOn(false);
      sendP2pVoiceSignal({ type: 'mute_state', isMuted: true });
    }
  };

  // Toggle Speaker Output Mute
  const toggleSpeaker = () => {
    sound.playClick();
    telegram.triggerHaptic('light');
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextState;
    }
  };

  // Process Incoming WebRTC Voice Signaling Messages over WebSocket
  useEffect(() => {
    if (!isP2PMatch) return;

    const handleVoiceSignal = async (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const data = customEvt.detail;
      if (!data || !data.signal) return;

      const { signal, senderId } = data;
      if (senderId === user.id) return; // Ignore self signals

      const pc = createPeerConnection();

      try {
        if (signal.type === 'offer') {
          // Received SDP Offer from opponent -> Get mic and send Answer
          setConnectionStatus('connecting');
          let stream = localStreamRef.current;
          if (!stream) {
            stream = await startMicrophone();
            if (stream) {
              stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
              setIsMicOn(true);
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendP2pVoiceSignal({
            type: 'answer',
            answer,
          });
          setConnectionStatus('connected');
        } else if (signal.type === 'answer') {
          // Received SDP Answer from opponent
          await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
          setConnectionStatus('connected');
        } else if (signal.type === 'candidate' && signal.candidate) {
          // Received ICE Candidate
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else if (signal.type === 'mute_state') {
          setIsRemoteSpeaking(!signal.isMuted);
        }
      } catch (err) {
        console.warn('WebRTC signal handling error:', err);
      }
    };

    window.addEventListener('p2p_voice_signal_received', handleVoiceSignal);
    return () => window.removeEventListener('p2p_voice_signal_received', handleVoiceSignal);
  }, [isP2PMatch, user.id, createPeerConnection, sendP2pVoiceSignal]);

  // Clean up when match ends or user exits match screen
  useEffect(() => {
    if (!isP2PMatch) {
      cleanupVoiceChat();
    }
  }, [isP2PMatch, cleanupVoiceChat]);

  if (!isP2PMatch) return null;

  return (
    <div className="w-full px-3 py-1.5 z-20 sticky top-14">
      {/* Hidden HTML Audio element for remote player voice output */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeakerOn} className="hidden" />

      {/* Live Voice Chat Bar Container */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2.5 shadow-[0_4px_20px_rgba(6,182,212,0.15)] flex flex-col gap-1.5 transition-all">
        <div className="flex items-center justify-between">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <Radio
                className={`w-4 h-4 transition-all ${
                  connectionStatus === 'connected'
                    ? 'text-cyan-400 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'text-amber-400 animate-spin'
                    : 'text-slate-500'
                }`}
              />
              {connectionStatus === 'connected' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wide text-white uppercase">Live Voice Chat</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-white/10'
                  }`}
                >
                  {connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFF'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {connectionStatus === 'connected'
                  ? `Talking with @${opponentName}`
                  : `Tap microphone to connect live with @${opponentName}`}
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5">
            {/* Audio Spectrum Waveform Indicator */}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-0.5 px-2 py-1 bg-slate-950/60 rounded-lg border border-white/5">
                <div
                  className={`w-1 rounded-full transition-all ${
                    isLocalSpeaking || isRemoteSpeaking ? 'h-3.5 bg-cyan-400 animate-pulse' : 'h-1.5 bg-slate-600'
                  }`}
                />
                <div
                  className={`w-1 rounded-full transition-all ${
                    isLocalSpeaking || isRemoteSpeaking ? 'h-4 bg-emerald-400 animate-pulse delay-75' : 'h-2 bg-slate-600'
                  }`}
                />
                <div
                  className={`w-1 rounded-full transition-all ${
                    isLocalSpeaking || isRemoteSpeaking ? 'h-2.5 bg-sky-400 animate-pulse delay-150' : 'h-1.5 bg-slate-600'
                  }`}
                />
              </div>
            )}

            {/* Mic Toggle Button */}
            <button
              onClick={toggleMic}
              title={isMicOn ? 'Mute Microphone' : 'Turn On Microphone'}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isMicOn
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)] scale-105'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-white/10'
              }`}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Speaker Toggle Button */}
            <button
              onClick={toggleSpeaker}
              title={isSpeakerOn ? 'Mute Opponent Audio' : 'Unmute Opponent Audio'}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isSpeakerOn
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Minimize Toggle */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Error Toast Warning */}
        {errorMessage && !isMinimized && (
          <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-[11px] text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
