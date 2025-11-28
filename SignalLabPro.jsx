import React, { useState, useRef, useEffect } from "react";

// Small FFT implementation for power-of-two sample counts
function fft(signalRe, signalIm) {
  const N = signalRe.length;
  const levels = Math.log2(N);
  if (Math.round(levels) !== levels) {
    throw new Error("FFT size must be power of 2");
  }
  const cosTable = new Array(N / 2);
  const sinTable = new Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    const angle = (2 * Math.PI * i) / N;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }
  // Bit-reversed addressing permutation
  for (let i = 0; i < N; i++) {
    let j = 0;
    for (let bit = 0; bit < levels; bit++) {
      j = (j << 1) | ((i >>> bit) & 1);
    }
    if (j > i) {
      [signalRe[i], signalRe[j]] = [signalRe[j], signalRe[i]];
      [signalIm[i], signalIm[j]] = [signalIm[j], signalIm[i]];
    }
  }
  // Cooley-Tukey
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2;
    const step = N / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < half; j++) {
        const k = j * step;
        const tRe = signalRe[i + j + half] * cosTable[k] + signalIm[i + j + half] * sinTable[k];
        const tIm = -signalRe[i + j + half] * sinTable[k] + signalIm[i + j + half] * cosTable[k];
        signalRe[i + j + half] = signalRe[i + j] - tRe;
        signalIm[i + j + half] = signalIm[i + j] - tIm;
        signalRe[i + j] += tRe;
        signalIm[i + j] += tIm;
      }
    }
  }
}

function generateSignal(type, opts) {
  const N = opts.fftSize;
  const fs = opts.sampleRate;
  const dt = 1 / fs;
  const t = new Array(N);
  const x = new Array(N);
  for (let n = 0; n < N; n++) {
    t[n] = n * dt;
    let v = 0;
    if (type === "sine") {
      v = Math.sin(2 * Math.PI * opts.freq1 * t[n]);
    } else if (type === "dual") {
      v =
        Math.sin(2 * Math.PI * opts.freq1 * t[n]) +
        0.6 * Math.sin(2 * Math.PI * opts.freq2 * t[n]);
    } else if (type === "square") {
      v = Math.sign(Math.sin(2 * Math.PI * opts.freq1 * t[n]));
    } else if (type === "chirp") {
      const f = opts.freq1 + (opts.freq2 - opts.freq1) * (n / N);
      v = Math.sin(2 * Math.PI * f * t[n]);
    }
    // Apply simple window to reduce leakage
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1));
    x[n] = v * w;
  }
  return { t, x };
}

function computeSpectrum(x, sampleRate) {
  const N = x.length;
  const re = x.slice();
  const im = new Array(N).fill(0);
  fft(re, im);
  const mag = new Array(N / 2);
  const freq = new Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / (N / 2);
    freq[k] = (k * sampleRate) / N;
  }
  return { freq, mag };
}

function drawLine(canvas, xs, ys, xLabel, yLabel) {
  if (!canvas || xs.length === 0) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = 32;

  // background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, W, H);

  const xmin = xs[0];
  const xmax = xs[xs.length - 1];
  let ymin = Math.min(...ys);
  let ymax = Math.max(...ys);
  if (ymax === ymin) {
    ymax += 1;
    ymin -= 1;
  }

  // axes
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.stroke();

  // line
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#38bdf8";
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const xNorm = (xs[i] - xmin) / (xmax - xmin || 1);
    const yNorm = (ys[i] - ymin) / (ymax - ymin || 1);
    const xPx = pad + xNorm * (W - 2 * pad);
    const yPx = H - pad - yNorm * (H - 2 * pad);
    if (i === 0) ctx.moveTo(xPx, yPx);
    else ctx.lineTo(xPx, yPx);
  }
  ctx.stroke();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px system-ui";
  ctx.fillText(xLabel, W - pad - 30, H - 10);
  ctx.save();
  ctx.translate(10, pad + 10);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawBars(canvas, xs, ys, xLabel, yLabel) {
  if (!canvas || xs.length === 0) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = 32;

  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, W, H);

  const xmin = xs[0];
  const xmax = xs[xs.length - 1];
  let ymin = 0;
  let ymax = Math.max(...ys) || 1;

  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, H - pad);
  ctx.lineTo(W - pad, H - pad);
  ctx.stroke();

  const barWidth = (W - 2 * pad) / xs.length;
  ctx.fillStyle = "#22c55e";
  for (let i = 0; i < xs.length; i++) {
    const xNorm = (xs[i] - xmin) / (xmax - xmin || 1);
    const xPx = pad + xNorm * (W - 2 * pad);
    const yNorm = ys[i] / (ymax - ymin || 1);
    const yPx = H - pad - yNorm * (H - 2 * pad);
    ctx.fillRect(xPx, yPx, barWidth * 0.9, H - pad - yPx);
  }

  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px system-ui";
  ctx.fillText(xLabel, W - pad - 30, H - 10);
  ctx.save();
  ctx.translate(10, pad + 10);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function SignalLabPro() {
  const [mode, setMode] = useState("synthetic"); // synthetic | file | mic
  const [signalType, setSignalType] = useState("sine");
  const [freq1, setFreq1] = useState(50);
  const [freq2, setFreq2] = useState(120);
  const [sampleRate, setSampleRate] = useState(2048);
  const [fftSize, setFftSize] = useState(1024);
  const [timeData, setTimeData] = useState({ t: [], x: [] });
  const [specData, setSpecData] = useState({ freq: [], mag: [] });
  const timeCanvasRef = useRef(null);
  const specCanvasRef = useRef(null);
  const micCanvasRef = useRef(null);
  const [audioInfo, setAudioInfo] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const micAnalyserRef = useRef(null);
  const micDataRef = useRef(null);
  const micAnimationRef = useRef(null);

  // Draw synthetic/file plots when data changes
  useEffect(() => {
    if (timeData.t.length > 0) {
      drawLine(timeCanvasRef.current, timeData.t, timeData.x, "time (s)", "amplitude");
    }
    if (specData.freq.length > 0) {
      drawBars(specCanvasRef.current, specData.freq, specData.mag, "frequency (Hz)", "|X(f)|");
    }
  }, [timeData, specData]);

  // Mic visualizer loop
  useEffect(() => {
    if (!micActive) {
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      const c = micCanvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
      }
      return;
    }
    const analyser = micAnalyserRef.current;
    const buf = micDataRef.current;
    if (!analyser || !buf) return;

    const canvas = micCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const pad = 24;

    const loop = () => {
      analyser.getByteFrequencyData(buf);
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, pad);
      ctx.lineTo(pad, H - pad);
      ctx.lineTo(W - pad, H - pad);
      ctx.stroke();

      const barCount = buf.length;
      const barWidth = (W - 2 * pad) / barCount;
      ctx.fillStyle = "#a855f7";
      for (let i = 0; i < barCount; i++) {
        const v = buf[i] / 255;
        const h = v * (H - 2 * pad);
        const x = pad + i * barWidth;
        const y = H - pad - h;
        ctx.fillRect(x, y, barWidth * 0.9, h);
      }
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px system-ui";
      ctx.fillText("live mic spectrum", W - pad - 70, H - 10);
      micAnimationRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    };
  }, [micActive]);

  function handleGenerateSynthetic() {
    try {
      const opts = { fftSize, sampleRate, freq1, freq2 };
      const { t, x } = generateSignal(signalType, opts);
      const spectrum = computeSpectrum(x, sampleRate);
      setTimeData({ t, x });
      setSpecData(spectrum);
      setAudioInfo({
        label: `Synthetic ${signalType} signal with f1=${freq1} Hz, f2=${freq2} Hz`,
      });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuf = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    const ch = audioBuf.getChannelData(0);
    const N = fftSize;
    const step = Math.floor(ch.length / N);
    const samples = new Array(N);
    for (let i = 0; i < N; i++) {
      samples[i] = ch[i * step] || 0;
    }
    const t = new Array(N);
    const dt = 1 / audioBuf.sampleRate;
    for (let i = 0; i < N; i++) t[i] = i * dt;
    const spectrum = computeSpectrum(samples, audioBuf.sampleRate);
    setTimeData({ t, x: samples });
    setSpecData(spectrum);
    setAudioInfo({
      label: `Audio file: ${file.name}, sampleRate=${audioBuf.sampleRate} Hz`,
    });
  }

  async function handleStartMic() {
    if (micActive) {
      setMicActive(false);
      if (micAnalyserRef.current && micAnalyserRef.current.context) {
        micAnalyserRef.current.context.close();
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      const bufLen = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufLen);
      src.connect(analyser);
      micAnalyserRef.current = analyser;
      micDataRef.current = dataArray;
      setMicActive(true);
      setAudioInfo({ label: "Microphone live spectrum" });
    } catch (err) {
      alert("Microphone access failed: " + err.message);
    }
  }

  function renderControls() {
    if (mode === "synthetic") {
      return (
        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ marginBottom: 8 }}>Synthetic Signal</h3>
          <span className="tag">Fourier training mode</span>
          <div style={{ height: 8 }} />
          <div className="label">Signal type</div>
          <select
            className="select"
            value={signalType}
            onChange={(e) => setSignalType(e.target.value)}
          >
            <option value="sine">Single sine</option>
            <option value="dual">Dual-tone (two sines)</option>
            <option value="square">Square wave</option>
            <option value="chirp">Chirp (sweep)</option>
          </select>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="label">f1 (Hz)</div>
              <input
                className="input"
                type="number"
                value={freq1}
                onChange={(e) => setFreq1(Number(e.target.value) || 0)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="label">f2 (Hz) (used in dual/chirp)</div>
              <input
                className="input"
                type="number"
                value={freq2}
                onChange={(e) => setFreq2(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="label">Sample rate (Hz)</div>
              <input
                className="input"
                type="number"
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value) || 1024)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="label">FFT size (power of 2)</div>
              <input
                className="input"
                type="number"
                value={fftSize}
                onChange={(e) => setFftSize(Number(e.target.value) || 1024)}
              />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button className="button button-primary" onClick={handleGenerateSynthetic}>
              Generate + Transform
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#9ca3af" }}>
            This generates a finite-length signal, applies a Hann window, and computes
            a complex FFT to obtain its magnitude spectrum.
          </p>
        </div>
      );
    }

    if (mode === "file") {
      return (
        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ marginBottom: 8 }}>Audio File Analyzer</h3>
          <span className="tag">Upload any .wav / .mp3</span>
          <div style={{ height: 8 }} />
          <div className="label">Choose audio file</div>
          <input
            className="input"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div className="label">FFT size (power of 2)</div>
              <input
                className="input"
                type="number"
                value={fftSize}
                onChange={(e) => setFftSize(Number(e.target.value) || 1024)}
              />
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#9ca3af" }}>
            The tool takes a slice of the uploaded audio, computes its FFT, and shows the
            time-domain snippet and magnitude spectrum.
          </p>
        </div>
      );
    }

    if (mode === "mic") {
      return (
        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ marginBottom: 8 }}>Live Microphone Spectrum</h3>
          <span className="tag">Real-time FFT via Web Audio</span>
          <div style={{ height: 8 }} />
          <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            Start the microphone visualizer and speak, clap, or play music near your mic to
            see the spectrum react in real time.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="button button-primary" onClick={handleStartMic}>
              {micActive ? "Stop microphone" : "Start microphone"}
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: "0.78rem", color: "#9ca3af" }}>
            Note: Your browser will ask for permission to use the microphone.
          </p>
        </div>
      );
    }

    return null;
  }

  return (
    <div>
      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === "synthetic" ? "active" : ""}`}
          onClick={() => setMode("synthetic")}
        >
          Synthetic Signals
        </button>
        <button
          className={`mode-tab ${mode === "file" ? "active" : ""}`}
          onClick={() => setMode("file")}
        >
          Audio File
        </button>
        <button
          className={`mode-tab ${mode === "mic" ? "active" : ""}`}
          onClick={() => setMode("mic")}
        >
          Microphone
        </button>
      </div>

      <div className="row" style={{ alignItems: "flex-start", marginBottom: 16 }}>
        {renderControls()}
        <div style={{ flex: 1.4, minWidth: 320 }}>
          <div className="panel">
            <h3 style={{ marginBottom: 4 }}>Visual Outputs</h3>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#9ca3af" }}>
              Time-domain signal (top) and Fourier magnitude spectrum (bottom). For microphone
              mode, only the live spectrum is active.
            </p>
            {audioInfo && (
              <p style={{ marginTop: 8, fontSize: "0.78rem", color: "#e5e7eb" }}>
                <strong>Current source:</strong> {audioInfo.label}
              </p>
            )}
            <div style={{ marginTop: 12 }}>
              {mode !== "mic" && (
                <>
                  <div className="canvas-container" style={{ marginBottom: 8 }}>
                    <div className="canvas-title">Time-domain signal</div>
                    <canvas ref={timeCanvasRef} width={640} height={180} />
                  </div>
                  <div className="canvas-container">
                    <div className="canvas-title">Magnitude spectrum</div>
                    <canvas ref={specCanvasRef} width={640} height={180} />
                  </div>
                </>
              )}
              {mode === "mic" && (
                <div className="canvas-container">
                  <div className="canvas-title">Live microphone spectrum</div>
                  <canvas ref={micCanvasRef} width={640} height={220} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignalLabPro;
