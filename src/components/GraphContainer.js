import React, { useRef } from 'react';
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
  const [gaugeRaw, ekgRaw, tilt, baseAtm, baseElev, absPressure] = [0, 1, 2, 3, 4, 5];

  const chartOptions = title => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      line: { tension: 0.4 },
      point: { radius: 0 }
    },
    scales: {
      x: {
        type: 'category',
        title: { display: true, text: 'Time (s)' },
        ticks: { maxRotation: 0 },
        grid: { display: false }
      },
      y: {
        title: {
          display: true,
          text: title.includes('Pressure') ? 'Pressure (mbar)' :
                title.includes('EKG') ? 'EKG (a.u.)' :
                title.includes('Tilt') ? 'Tilt (°)' : 'Value'
        },
        beginAtZero: false,
        grid: { display: false }
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
    fill: false
  });

  return (
    <div className="graph-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
      <div style={{ height: '320px', width: '100%' }}>
        <h3>Gauge Pressure vs Time (Raw)</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Gauge Pressure (Raw)', 'green', gaugeRaw)] }}
          options={chartOptions('Gauge Pressure vs Time (Raw)')}
        />
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <h3>Raw EKG vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Raw EKG', 'red', ekgRaw)] }}
          options={chartOptions('Raw EKG vs Time')}
        />
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <h3>Tilt Angle vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Tilt Angle (°)', 'orange', tilt)] }}
          options={chartOptions('Tilt Angle vs Time')}
        />
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <h3>Baseline Atmospheric Pressure vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Baseline Atm (mbar)', 'gray', baseAtm)] }}
          options={chartOptions('Baseline Atmospheric Pressure vs Time')}
        />
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <h3>Baseline Elevation vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Baseline Elevation (m)', 'purple', baseElev)] }}
          options={chartOptions('Baseline Elevation vs Time')}
        />
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <h3>Absolute Pressure vs Time</h3>
        <Line
          data={{ labels: times, datasets: [generateDataset('Absolute Pressure (mbar)', 'blue', absPressure)] }}
          options={chartOptions('Absolute Pressure vs Time')}
        />
      </div>
    </div>
  );
};

export default GraphContainer;
