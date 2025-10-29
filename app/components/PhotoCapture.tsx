import { useEffect, useRef, useState } from "react";

interface PhotoCaptureProps {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

export default function PhotoCapture({ onCapture, onCancel }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        setStream(mediaStream);
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg'));

    canvas.toBlob((blob) => {
      if (blob) {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }, 'image/jpeg', 0.8);
  };

  const retakePhoto = () => {
    setPhoto(null);
  };

  const confirmPhoto = () => {
    if (!photo) return;

    fetch(photo)
      .then(res => res.blob())
      .then(blob => {
        onCapture(blob);
      });
  };

  if (photo) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-1 relative">
          <img src={photo} alt="Captured" className="w-full h-full object-contain" />
        </div>

        <div className="flex">
          <button
            onClick={retakePhoto}
            className="flex-1 bg-gray-600 text-white py-4 text-lg font-semibold"
          >
            Retake
          </button>
          <button
            onClick={confirmPhoto}
            className="flex-1 bg-green-600 text-white py-4 text-lg font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-white text-center">
          <div className="text-xl font-bold">Take Photo Proof</div>
          <div className="text-sm mt-2">Show task completion</div>
        </div>
      </div>

      <div className="flex">
        <button
          onClick={onCancel}
          className="flex-1 bg-red-600 text-white py-4 text-lg font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={takePhoto}
          className="flex-1 bg-blue-600 text-white py-4 text-lg font-semibold"
        >
          Capture
        </button>
      </div>
    </div>
  );
}