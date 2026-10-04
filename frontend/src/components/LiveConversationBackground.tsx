import React, { useEffect, useRef } from 'react';
import { Mic, Radio, Activity, Wifi, Sparkles, Layers, Volume2 } from 'lucide-react';

interface LiveConversationBackgroundProps {
  /** Optional audio activity level (0-100) to make waves react live to speaking */
  rmsLevel?: number;
  isSpeaking?: boolean;
}

export const LiveConversationBackground: React.FC<LiveConversationBackgroundProps> = ({
  rmsLevel = 0,
  isSpeaking = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Audio mesh node points representing distributed microphones
    const nodeCount = 9;
    interface MeshNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      label: string;
      rippleRadius: number;
      rippleAlpha: number;
      rippleSpeed: number;
    }

    const colors = [
      'rgba(99, 102, 241, ', // Indigo
      'rgba(6, 182, 212, ',  // Cyan
      'rgba(168, 85, 247, ', // Purple
      'rgba(16, 185, 129, ', // Emerald
      'rgba(244, 63, 94, ',  // Rose
    ];

    const labels = [
      'Host Node',
      'Phone Mic',
      'Tablet A',
      'Laptop Mesh',
      'Mobile Node',
      'Phone B',
      'Satellite Mic',
      'Room Node',
      'VAD Sync',
    ];

    const nodes: MeshNode[] = Array.from({ length: nodeCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2.5 + 3.5,
      color: colors[i % colors.length],
      label: labels[i % labels.length],
      rippleRadius: Math.random() * 40,
      rippleAlpha: Math.random() * 0.5 + 0.3,
      rippleSpeed: Math.random() * 0.35 + 0.25,
    }));

    let phase = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Boost amplitude subtly if speaking or rmsLevel detected
      const speechBoost = isSpeaking ? 1.8 : 1 + (rmsLevel / 100) * 0.8;
      phase += 0.015 * speechBoost;

      // 1. Draw Multi-Layer Flowing Acoustic Sine Soundwaves
      const waveConfigs = [
        {
          baseY: height * 0.62,
          amplitude: 45 * speechBoost,
          frequency: 0.0028,
          phaseOffset: 0,
          color1: 'rgba(99, 102, 241, 0.12)',
          color2: 'rgba(6, 182, 212, 0.08)',
          lineWidth: 2.5,
        },
        {
          baseY: height * 0.68,
          amplitude: 38 * speechBoost,
          frequency: 0.0035,
          phaseOffset: 1.8,
          color1: 'rgba(168, 85, 247, 0.11)',
          color2: 'rgba(236, 72, 153, 0.07)',
          lineWidth: 2,
        },
        {
          baseY: height * 0.74,
          amplitude: 52 * speechBoost,
          frequency: 0.0022,
          phaseOffset: 3.4,
          color1: 'rgba(16, 185, 129, 0.09)',
          color2: 'rgba(59, 130, 246, 0.06)',
          lineWidth: 2,
        },
        {
          baseY: height * 0.55,
          amplitude: 28 * speechBoost,
          frequency: 0.0042,
          phaseOffset: 4.8,
          color1: 'rgba(6, 182, 212, 0.08)',
          color2: 'rgba(99, 102, 241, 0.04)',
          lineWidth: 1.5,
        },
      ];

      waveConfigs.forEach((cfg) => {
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(0, cfg.baseY - cfg.amplitude, width, cfg.baseY + cfg.amplitude);
        gradient.addColorStop(0, cfg.color1);
        gradient.addColorStop(0.5, cfg.color2);
        gradient.addColorStop(1, cfg.color1);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = cfg.lineWidth;

        for (let x = 0; x <= width; x += 6) {
          // Compound sinusoidal harmonics for natural speech wave motion
          const y =
            cfg.baseY +
            Math.sin(x * cfg.frequency + phase + cfg.phaseOffset) * cfg.amplitude +
            Math.sin(x * cfg.frequency * 2.3 + phase * 1.4) * (cfg.amplitude * 0.35);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // 2. Draw Constellation Mesh lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 260) {
            const alpha = (1 - dist / 260) * 0.16;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // 3. Update & Draw Mesh Nodes with Concentric Soundwave Ripples
      nodes.forEach((node) => {
        // Move nodes gently
        node.x += node.vx;
        node.y += node.vy;

        // Bounce gently inside canvas bounds
        if (node.x < 30 || node.x > width - 30) node.vx *= -1;
        if (node.y < 30 || node.y > height - 30) node.vy *= -1;

        // Expanding Acoustic Ripple (Sound Emitter effect)
        node.rippleRadius += node.rippleSpeed * speechBoost;
        node.rippleAlpha -= 0.004 * speechBoost;

        if (node.rippleAlpha <= 0 || node.rippleRadius > 70) {
          node.rippleRadius = node.radius;
          node.rippleAlpha = 0.45;
        }

        // Draw outer acoustic pulse wave
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}${node.rippleAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Draw secondary harmonic ring
        if (node.rippleRadius > 25) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.rippleRadius - 20, 0, Math.PI * 2);
          ctx.strokeStyle = `${node.color}${node.rippleAlpha * 0.6})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw core node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}0.85)`;
        ctx.shadowColor = `${node.color}0.5)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw tiny label badge
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.fillStyle = 'rgba(71, 85, 105, 0.65)';
        ctx.fillText(node.label, node.x + 9, node.y + 3);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [rmsLevel, isSpeaking]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Base Subtle Geometric Speech Dot Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#6366f10c_1px,transparent_1px),linear-gradient(to_bottom,#6366f10c_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_65%,transparent_100%)] opacity-85" />

      {/* 2. Three Soft Pastel Ambient Glow Orbs */}
      <div className="absolute top-[-10%] left-[-8%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-300/35 via-violet-300/25 to-transparent blur-[130px] animate-float-slow" />
      <div className="absolute top-[30%] right-[-10%] w-[550px] h-[550px] rounded-full bg-gradient-to-bl from-cyan-300/30 via-sky-300/20 to-transparent blur-[140px] animate-float-reverse" />
      <div className="absolute bottom-[-15%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-t from-pink-300/25 via-purple-300/20 to-transparent blur-[150px] animate-pulse-glow" />

      {/* 3. Live Animated Acoustic Soundwave Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-85" />

      {/* 4. Live Acoustic Speech Emitter Corner Accents (Concentric Pulsing Ripples) */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full border border-indigo-400/20 animate-ping opacity-40 [animation-duration:4s]" />
      <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full border border-cyan-400/25 animate-pulse opacity-50" />

      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full border border-purple-400/20 animate-ping opacity-35 [animation-duration:5s]" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full border border-indigo-400/25 animate-pulse opacity-45" />

      {/* 5. Floating Transcription & Audio Mesh Conversation Tokens */}
      {/* Token 1: Live Speech 16kHz */}
      <div className="absolute top-[18%] left-[6%] hidden xl:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-indigo-200/80 shadow-sm text-[11px] font-mono font-bold text-indigo-700 animate-float-slow">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <Mic className="w-3.5 h-3.5 text-indigo-600" />
        <span>Live Speech • 16kHz</span>
      </div>

      {/* Token 2: Acoustic Mesh Synchronized */}
      <div className="absolute top-[32%] right-[5%] hidden lg:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-cyan-200/80 shadow-sm text-[11px] font-mono font-bold text-cyan-800 animate-float-reverse">
        <Radio className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
        <span>Mesh Constellation Active</span>
      </div>

      {/* Token 3: Proximity Energy Attribution */}
      <div className="absolute bottom-[24%] left-[8%] hidden lg:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-purple-200/80 shadow-sm text-[11px] font-mono font-bold text-purple-700 animate-pulse-glow">
        <Layers className="w-3.5 h-3.5 text-purple-600" />
        <span>Multi-Device Diarization</span>
      </div>

      {/* Token 4: Overlap Isolation Engine */}
      <div className="absolute bottom-[18%] right-[7%] hidden xl:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-amber-200/90 shadow-sm text-[11px] font-mono font-bold text-amber-800 animate-float-slow">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span>Overlap Speech Separation</span>
      </div>

      {/* 6. Subtle Floating Sound Wave Equalizer Silhouettes */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex items-end space-x-1.5 h-8 opacity-35">
        <div className="w-1 bg-indigo-500 rounded-full wave-bar-1" />
        <div className="w-1 bg-cyan-500 rounded-full wave-bar-2" />
        <div className="w-1 bg-purple-500 rounded-full wave-bar-3" />
        <div className="w-1 bg-emerald-500 rounded-full wave-bar-4" />
        <div className="w-1 bg-pink-500 rounded-full wave-bar-5" />
        <div className="w-1 bg-indigo-500 rounded-full wave-bar-2" />
        <div className="w-1 bg-cyan-500 rounded-full wave-bar-4" />
        <div className="w-1 bg-purple-500 rounded-full wave-bar-1" />
      </div>
    </div>
  );
};
