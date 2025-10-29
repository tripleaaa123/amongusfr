import { useEffect, useRef, useState } from "react";

interface CameraScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
}

export default function CameraScanner({ onScan, onCancel }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setScanning(true);
        startScanLoop();
      } catch (err) {
        setError("Camera access denied");
      }
    };

    const startScanLoop = () => {
      const scanInterval = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          if ('BarcodeDetector' in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            detector.detect(imageData).then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                clearInterval(scanInterval);
                stopCamera();
                onScan(barcodes[0].rawValue);
              }
            });
          }
        } catch (err) {
          console.error('QR scan error:', err);
        }
      }, 500);

      return () => clearInterval(scanInterval);
    };

    const stopCamera = () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };

    startCamera();

    return () => {
      stopCamera();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 border-4 border-white rounded-lg opacity-50" />
        </div>

        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-white text-center">
          <div className="text-xl font-bold">Scan QR Code</div>
          <div className="text-sm mt-2">Point camera at QR code</div>
        </div>
      </div>

      <button
        onClick={onCancel}
        className="bg-red-600 text-white py-4 text-lg font-semibold"
      >
        Cancel
      </button>

      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-900 text-white p-4 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}