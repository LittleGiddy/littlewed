// components/qr-code-preview.tsx
'use client';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodePreviewProps {
  value: string;
  size: number;
  color?: string;
  bgColor?: string;
}

export function QRCodePreview({ value, size, color = '#000000', bgColor = '#ffffff' }: QRCodePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 2,
      color: {
        dark: color,
        light: bgColor,
      },
      errorCorrectionLevel: 'M',
    }, (error) => {
      if (error) console.error('QR Code generation error:', error);
    });
  }, [value, size, color, bgColor]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />;
}