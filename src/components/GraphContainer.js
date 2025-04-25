import React, { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Legend,
  Title,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Legend,
  Title,
  Filler
);

const GraphContainer = ({ dataPoints = [] }) => {
  const chartRef = useRef();
  if (!Array.isArray(dataPoints)) return null;

  const times = dataPoints.map(dp => dp.formattedTime || '');
  const [basatm, gauge, normg, tilt, elev, ecg, norm_ecg] = [0, 1, 2, 3, 4, 5, 6];

  const chartOptions = title => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        type: 'category',
        title: { display: true, text: 'Time (s)' },
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          callback: function (val, index) {
            return times[index];
          }
        }
      },
      y: {
        title: {
          display: true,
          text: title.includes('Pressure') ? 'Pressure (mbar)' : title.includes('Tilt') ? 'Tilt (°)' : title.includes('ECG') ? 'ECG Value' : 'Elevation (m)'
        },
        beginAtZero: false
      }
    },
    plugins: {
      legend: { display: true },
      title: { display: true, text: title }
    }
  });

  const generateDataset = (label, color, index) => ({
    label,
    data: dataPoints.map(dp => dp.values?.[index] ?? null),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    fill: false,
    tension: 0.2,
    pointRadius: 1
  });

  return (
    <div className="graph-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(700px, 1fr))', gap: '40px', maxWidth: '100vw' }}>
      <div style={{ width: '100%', height: '300px' }}>
        <h3>Gauge Pressure vs Time (Raw)</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Gauge Pressure (mbar)', 'green', gauge)] }}
          options={chartOptions('Gauge Pressure vs Time (Raw)')}
        />
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <h3>Gauge Pressure vs Time (ECG-Filtered)</h3>
        <Line
          ref={chartRef}
          data={{ labels: times, datasets: [generateDataset('Normalized Gauge Pressure (mbar)', 'blue', normg)] }}
          options={chartOptions('Gauge Pressure vs Time (ECG-Filtered)')}
        />
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <h4>Baseline Atmospheric Pressure vs Time</h4>
        <Line
          data={{ labels: times, datasets: [generateDataset('Baseline Atm Pressure (mbar)', 'gray', basatm)] }}
          options={chartOptions('Baseline Pressure vs Time')}
        />
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <h3>Tilt Angle vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Tilt Angle (°)', 'orange', tilt)] }}
          options={chartOptions('Tilt Angle vs Time')}
        />
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <h3>Elevation vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Elevation (m)', 'purple', elev)] }}
          options={chartOptions('Elevation vs Time')}
        />
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <h3>ECG vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('ECG Raw Value', 'red', ecg), generateDataset('ECG Normalized', 'blue', norm_ecg)] }}
          options={chartOptions('ECG vs Time')}
        />
      </div>
    </div>
  );
};

export default GraphContainer;
