'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet icon issue in Next.js
const iconFix = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
}

export default function LeafletMap({ latitude, longitude, zoom = 12 }: LeafletMapProps) {
  useEffect(() => {
    iconFix();
  }, []);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-100">
      <MapContainer 
        center={[latitude, longitude]} 
        zoom={zoom} 
        scrollWheelZoom={false} 
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]}>
        </Marker>
      </MapContainer>
    </div>
  );
}