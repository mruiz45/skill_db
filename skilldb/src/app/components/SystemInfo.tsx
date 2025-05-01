import React, { useEffect, useState } from 'react';

interface SystemInfoProps {
  title: string;
}

interface BrowserInfo {
  name: string;
  version: string;
  os: string;
}

const SystemInfo: React.FC<SystemInfoProps> = ({ title }) => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const detectBrowser = (): BrowserInfo => {
      const userAgent = navigator.userAgent;
      let name = 'Unknown';
      let version = 'Unknown';
      let os = 'Unknown';

      // Détection du système d'exploitation
      if (userAgent.indexOf('Windows') !== -1) os = 'Windows';
      else if (userAgent.indexOf('Mac') !== -1) os = 'MacOS';
      else if (userAgent.indexOf('Linux') !== -1) os = 'Linux';
      else if (userAgent.indexOf('Android') !== -1) os = 'Android';
      else if (userAgent.indexOf('iOS') !== -1) os = 'iOS';

      // Détection du navigateur
      if (userAgent.indexOf('Firefox') !== -1) {
        name = 'Firefox';
        version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Edg') !== -1) {
        name = 'Microsoft Edge';
        version = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Chrome') !== -1) {
        name = 'Chrome';
        version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
      } else if (userAgent.indexOf('Safari') !== -1) {
        name = 'Safari';
        version = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
      }

      return { name, version, os };
    };

    setBrowserInfo(detectBrowser());
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      {browserInfo ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">Navigateur</h3>
            <p>
              {browserInfo.name} {browserInfo.version}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Système d'exploitation</h3>
            <p>{browserInfo.os}</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Résolution d'écran</h3>
            <p>{windowSize.width} x {windowSize.height} pixels</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Date et heure</h3>
            <p>{new Date().toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <p>Chargement des informations...</p>
      )}
    </div>
  );
};

export default SystemInfo; 