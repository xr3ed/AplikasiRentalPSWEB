'use client';

import { useEffect, useRef } from 'react';

interface ChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  type: 'line' | 'bar' | 'doughnut';
  title?: string;
  height?: number;
  className?: string;
}

export const Chart = ({ data, type, title, height = 200, className = '' }: ChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const padding = 40;
    const chartWidth = canvas.offsetWidth - padding * 2;
    const chartHeight = height - padding * 2;

    if (type === 'bar') {
      drawBarChart(ctx, data, padding, chartWidth, chartHeight);
    } else if (type === 'line') {
      drawLineChart(ctx, data, padding, chartWidth, chartHeight);
    } else if (type === 'doughnut') {
      drawDoughnutChart(ctx, data, canvas.offsetWidth / 2, height / 2, Math.min(chartWidth, chartHeight) / 3);
    }
  }, [data, type, height]);

  const drawBarChart = (ctx: CanvasRenderingContext2D, data: any[], padding: number, width: number, height: number) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = width / data.length * 0.8;
    const barSpacing = width / data.length * 0.2;

    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * height;
      const x = padding + index * (barWidth + barSpacing);
      const y = padding + height - barHeight;

      // Draw bar with gradient
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, item.color || '#ef4444');
      gradient.addColorStop(1, item.color ? item.color + '80' : '#ef444480');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, padding + height + 20);

      // Draw value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(item.value.toString(), x + barWidth / 2, y - 5);
    });
  };

  const drawLineChart = (ctx: CanvasRenderingContext2D, data: any[], padding: number, width: number, height: number) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const stepX = width / (data.length - 1);

    // Draw grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((item, index) => {
      const x = padding + index * stepX;
      const y = padding + height - (item.value / maxValue) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw points
    data.forEach((item, index) => {
      const x = padding + index * stepX;
      const y = padding + height - (item.value / maxValue) * height;

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw labels
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x, padding + height + 20);
    });
  };

  const drawDoughnutChart = (ctx: CanvasRenderingContext2D, data: any[], centerX: number, centerY: number, radius: number) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * Math.PI * 2;
      
      // Draw slice
      ctx.fillStyle = item.color || `hsl(${index * 60}, 70%, 50%)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, radius * 0.6, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fill();

      currentAngle += sliceAngle;
    });

    // Draw center circle
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
};

export default Chart;
