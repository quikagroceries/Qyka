"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

// Live biometric capture (brief: "Real-time camera capture prompt matching
// ID"). Opens the front camera via getUserMedia, grabs a still to canvas on
// capture — no third-party face-match here, that's a backend/vendor
// integration this form only collects the photo for.
function SelfieCapture({
  value,
  onChange,
  error,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camError, setCamError] = useState("");

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => stopCamera, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError("Could not access the camera. Check your browser permissions and try again.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      stopCamera();
      setCameraOpen(false);
    }, "image/jpeg", 0.9);
  }

  function closeCamera() {
    stopCamera();
    setCameraOpen(false);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-ink">
        Live selfie verification <span className="text-brand-orange-dark">*</span>
      </label>

      {cameraOpen ? (
        <div className="overflow-hidden rounded-2xl border border-line-strong bg-ink">
          <video ref={videoRef} playsInline muted className="aspect-square w-full -scale-x-100 object-cover" />
          <div className="flex gap-2 bg-surface p-3">
            <Button type="button" onClick={capture} fullWidth>Capture</Button>
            <Button type="button" variant="neutral" onClick={closeCamera}>Cancel</Button>
          </div>
        </div>
      ) : value && previewUrl ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-canvas p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selfie preview" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1 text-sm text-muted">Selfie captured. Make sure your face matches your ID photo.</div>
          <button
            type="button"
            onClick={openCamera}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-brand-orange-dark hover:underline"
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openCamera}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-canvas px-4 text-sm font-semibold text-muted transition hover:border-brand-orange hover:text-brand-orange-dark"
        >
          <Icon name="camera" className="h-4 w-4" />
          Open camera for live selfie
        </button>
      )}
      {camError && <p className="mt-1 text-xs font-semibold text-red-600">{camError}</p>}
      {error && !camError && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export default SelfieCapture;
