import React, { useState, useEffect } from 'react';
import {
  Upload,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Sliders,
  CheckCircle2,
  Layers,
  Info,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { SampleImage, PredictionResult } from '../types';

interface ModelInfo {
  resolution?: number;
  test_accuracy?: number;
  validation_accuracy?: number;
  specificity?: number;
  sensitivity?: number;
  precision?: number;
  f1?: number;
}

export const PredictPage: React.FC = () => {
  const [samples, setSamples] = useState<SampleImage[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [heatmapAlpha, setHeatmapAlpha] = useState(0.5);
  const [apiError, setApiError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    // Load sample benchmark images
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => setSamples(data))
      .catch((err) => console.error('Failed to load sample images', err));

    // Load active model metadata (resolution, accuracy, specificity)
    fetch('/api/model-info')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Model info not loaded');
      })
      .then((data) => setModelInfo(data))
      .catch((err) => console.warn('Could not load /api/model-info:', err));
  }, []);

  const handleSelectSample = async (sample: SampleImage) => {
    setSelectedSampleId(sample.id);
    setUploadedFile(null);
    setUploadedImagePreview(sample.image_url ?? sample.image_data_url ?? null);
    setPrediction(null);
    setApiError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/predict/sample/${sample.id}`, { method: 'POST' });
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.detail ?? 'Model not yet available (503). Training run is in progress — please wait and retry.');
        return;
      }
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error('Inference error', err);
      setApiError('Network error — could not reach the inference server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedSampleId(null);
    setUploadedFile(file);
    setPrediction(null);
    setApiError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeUpload = async () => {
    if (!uploadedFile) return;
    setIsLoading(true);
    setPrediction(null);
    setApiError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        setApiError(body.detail ?? 'Model not yet available (503). Training is still in progress.');
        return;
      }
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error('Upload analysis failed', err);
      setApiError('Network error — could not reach the inference server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Probabilities and plain leaning text
  const pNorm = prediction?.probabilities?.normal ?? 0;
  const pPneu = prediction?.probabilities?.pneumonia ?? 0;
  const normPct = (pNorm * 100).toFixed(1);
  const pneuPct = (pPneu * 100).toFixed(1);
  const winningClass = pPneu >= pNorm ? 'Pneumonia' : 'Normal';
  const winningPct = Math.round(Math.max(pNorm, pPneu) * 100);
  const leanSentence = `The model leans ${winningClass} (${winningPct}%)`;

  const isUncertain = (prediction?.uncertain ?? false) || Math.max(pNorm, pPneu) < 0.70;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={24} color="var(--cyan-bright)" />
          Pneumonia Prediction &amp; Visual Heatmaps
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Run chest X-ray predictions using the trained global model with 4 image sanity checks and Grad-CAM visual heatmaps.
        </p>
      </div>

      {/* 503 / Network Error Banner */}
      {apiError && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1.5px solid rgba(245, 158, 11, 0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          color: '#fbbf24',
          fontSize: '0.875rem',
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Model Unavailable</strong>
            {apiError}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Model Card, Upload (First), Compact Sample Strip (Below Upload), Slider, Guardrails */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Model Card */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Cpu size={18} color="var(--cyan-bright)" />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>LOADED MODEL</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>PneumoniaCNN</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>RESOLUTION</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {modelInfo?.resolution ? `${modelInfo.resolution} × ${modelInfo.resolution} px` : '128 × 128 px'}
              </span>
            </div>
          </div>

          {/* Upload Card - PLACED FIRST */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#ffffff' }}>
              Upload Patient Radiograph
            </h3>
            <label
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: '10px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                background: 'rgba(11, 18, 32, 0.5)',
                transition: 'border-color 0.2s ease',
              }}
            >
              <Upload size={24} color="var(--cyan-bright)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                Drag &amp; drop or click to browse
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Supports PNG, JPEG, DICOM-exported Grayscale
              </span>
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            {uploadedFile && (
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Selected: <strong>{uploadedFile.name}</strong>
                </span>
                <button className="btn-primary" onClick={handleAnalyzeUpload} disabled={isLoading}>
                  {isLoading ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>
            )}
          </div>

          {/* Compact Sample Gallery - Single-row horizontal strip under "Or try a sample", below upload */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                Or try a sample
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {samples.length > 0 ? `${samples.length} benchmark cases (128×128)` : 'Benchmark cases (128×128)'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                overflowX: 'auto',
                paddingBottom: '0.4rem',
                scrollbarWidth: 'thin',
              }}
            >
              {samples.map((s, idx) => {
                const isSelected = selectedSampleId === s.id;
                const isNormal = s.label?.toLowerCase() === 'normal';
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => handleSelectSample(s)}
                    title={`${s.label} (${s.id}) - click to analyze`}
                    style={{
                      width: '56px',
                      minWidth: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      padding: 0,
                      background: '#000000',
                      border: isSelected ? '2px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    {s.image_url || s.image_data_url ? (
                      <img
                        src={s.image_url ?? s.image_data_url}
                        alt={s.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.65rem' }}>
                        #{idx + 1}
                      </div>
                    )}
                    {/* Small color indicator dot on top-right */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '3px',
                        right: '3px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: isNormal ? '#34d399' : '#f87171',
                        border: '1px solid #000000',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Heatmap Alpha Slider */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Sliders size={15} color="var(--cyan-bright)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                Grad-CAM Overlay Intensity
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan-bright)' }}>
                α = {heatmapAlpha.toFixed(2)}
              </span>
            </div>
            <input
              id="heatmap-alpha-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={heatmapAlpha}
              onChange={(e) => setHeatmapAlpha(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--cyan-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>Original Only</span>
              <span>Full Heatmap</span>
            </div>
          </div>

          {/* OOD Guardrail Specifications Banner */}
          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(13, 21, 37, 0.7)' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cyan-bright)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} />
              4 Image Sanity Guardrails
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <li>✓ <strong>File &amp; Dimension:</strong> Valid decodable image with minimum size ≥ 32 px.</li>
              <li>✓ <strong>Aspect Ratio:</strong> Ratio between 0.4 and 2.5 (rejects extreme panoramas or strips).</li>
              <li>✓ <strong>Color &amp; Contrast:</strong> Grayscale variance std ≥ 8 and channel difference ≤ 20 (rejects color photos and blank images).</li>
              <li>✓ <strong>Soft Uncertainty Floor:</strong> Soft warning banner displayed for predictions with confidence &lt; 70%.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Diagnostic Output & Explainability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {isLoading ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--cyan-bright)' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin-slow 1s linear infinite' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Executing Diagnostic Pipeline...</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Running OOD verification &amp; PyTorch Grad-CAM</p>
            </div>
          ) : !prediction ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Active Diagnosis</h3>
              <p style={{ fontSize: '0.8rem' }}>Upload an image above or select a benchmark sample to view diagnostic predictions and localized Grad-CAM heatmaps.</p>
            </div>
          ) : prediction.status === 'rejected' ? (
            /* OOD Rejection Panel */
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1.5px solid #ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert size={22} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', color: '#fca5a5' }}>
                    Out-Of-Distribution Rejection
                  </h3>
                  <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>{prediction.error_type || 'GUARDRAIL REJECTION'}</span>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#f8fafc', marginBottom: '1rem', lineHeight: '1.5' }}>
                {prediction.reason}
              </p>

              {prediction.details && (
                <div style={{ background: 'rgba(11, 18, 32, 0.8)', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    DIAGNOSTIC TELEMETRY:
                  </span>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#67e8f9', margin: 0 }}>
                    {JSON.stringify(prediction.details, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Info size={14} />
                <span>{prediction.disclaimer}</span>
              </div>
            </div>
          ) : (
            /* Accepted Diagnostic Panel */
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Verdict Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color: prediction.prediction === 'Pneumonia' ? '#f87171' : '#34d399' }}>
                      {prediction.prediction?.toUpperCase()}
                    </h3>
                    <span className={prediction.prediction === 'Pneumonia' ? 'badge badge-red' : 'badge badge-green'}>
                      {prediction.prediction === 'Pneumonia' ? 'Infection Detected' : 'Clear Lung Fields'}
                    </span>
                    {isUncertain && (
                      <span className="badge badge-amber" title="Posterior confidence < 70% — interpret with caution">
                        Uncertain, interpret with caution
                      </span>
                    )}
                  </div>
                  {/* One plain line: "The model leans Pneumonia (82%)" */}
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    {leanSentence}
                  </p>
                </div>
              </div>

              {/* Both Probabilities: Visual Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'var(--bg-secondary)', padding: '0.9rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  POSTERIOR CLASS PROBABILITIES
                </span>

                {/* Normal bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Normal</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#34d399' }}>{normPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${normPct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Pneumonia bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pneumonia</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f87171' }}>{pneuPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pneuPct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ef4444, #f87171)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* True-label match badge (sample predictions only) */}
              {prediction.true_label !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {prediction.is_match ? (
                    <CheckCircle2 size={16} color="#10b981" />
                  ) : (
                    <AlertTriangle size={16} color="#f59e0b" />
                  )}
                  <span>
                    Ground-truth label: <strong style={{ color: '#ffffff' }}>{prediction.true_label}</strong>
                    {prediction.is_match
                      ? <span style={{ color: '#10b981', marginLeft: '0.4rem' }}>✓ Correct</span>
                      : <span style={{ color: '#f59e0b', marginLeft: '0.4rem' }}>✗ Mismatch</span>}
                  </span>
                </div>
              )}

              {/* Side-by-Side Images: Original vs Grad-CAM Overlay */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Original */}
                <div style={{ background: '#000000', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Input Radiograph
                  </div>
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploadedImagePreview && (
                      <img src={uploadedImagePreview} alt="Original" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </div>
                </div>

                {/* Grad-CAM Heatmap */}
                <div style={{ background: '#000000', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(6, 182, 212, 0.4)', display: 'flex', flexDirection: 'column', boxShadow: '0 0 20px -5px rgba(6, 182, 212, 0.3)' }}>
                  <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(6, 182, 212, 0.1)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--cyan-bright)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Grad-CAM Saliency Overlay</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>α={heatmapAlpha.toFixed(2)}</span>
                  </div>
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {prediction.heatmap_data_url ? (
                      <img src={prediction.heatmap_data_url} alt="Grad-CAM" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grad-CAM not available</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Static Grad-CAM Caption */}
              {prediction.caption && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.06)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '0.1rem', color: 'var(--cyan-bright)' }} />
                  <span>{prediction.caption}</span>
                </div>
              )}

              {/* Regulatory Disclaimer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <Info size={14} />
                <span>{prediction.disclaimer}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
