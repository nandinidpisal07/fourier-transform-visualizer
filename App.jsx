import SignalLabPro from "./components/SignalLabPro.jsx";

export default function App() {
  return (
    <div className="app-root">
      <h1 style={{ fontSize: "1.8rem", marginBottom: 4 }}>SignalLab Pro</h1>
      <p style={{ marginBottom: 18, color: "#9ca3af", fontSize: "0.9rem" }}>
        An interactive Fourier transform studio for synthetic signals, audio files, and live microphone input.
      </p>
      <SignalLabPro />
      <footer>
        Built as a learning tool: visualize time-domain signals, spectra, and a rolling spectrogram.
      </footer>
    </div>
  );
}
