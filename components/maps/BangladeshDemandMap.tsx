"use client";

import dynamic from "next/dynamic";

type DemandRegion = {
  region: string;
  lat: number;
  lng: number;
  demand: number;
  growth: number;
  risk: "low" | "medium" | "high" | "critical";
};

const Map = dynamic(async () => {
  const leaflet = await import("react-leaflet");
  return function DemandMap({ data }: { data: DemandRegion[] }) {
    return (
      <leaflet.MapContainer center={[23.685, 90.3563]} zoom={6.6} scrollWheelZoom={false} className="h-[380px] w-full">
        <leaflet.TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {data.map((city) => (
          <leaflet.CircleMarker
            key={city.region}
            center={[city.lat, city.lng]}
            radius={Math.max(8, city.demand / 600)}
            pathOptions={{ color: city.risk === "high" ? "#dc2626" : city.risk === "medium" ? "#f59e0b" : "#0f766e", fillOpacity: 0.45 }}
          >
            <leaflet.Popup>
              <strong>{city.region}</strong>
              <br />
              Demand: {city.demand}
              <br />
              Growth: {city.growth}%
            </leaflet.Popup>
          </leaflet.CircleMarker>
        ))}
      </leaflet.MapContainer>
    );
  };
}, { ssr: false });

export function BangladeshDemandMap({ data }: { data?: DemandRegion[] }) {
  const mapData: DemandRegion[] = data?.length ? data : [];
  if (!mapData.length) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-border bg-slate-50 p-6 text-center">
        <div>
          <div className="text-lg font-semibold text-slate-900">No regional rows in the current file</div>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Add region/city and demand columns to the uploaded workbook to render the Bangladesh demand map from that exact file.
          </p>
        </div>
      </div>
    );
  }
  const totalDemand = mapData.reduce((sum, item) => sum + item.demand, 0);
  const topRegion = mapData.reduce((top, item) => (item.demand > top.demand ? item : top), mapData[0]);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <Map data={mapData} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MapMetric label="Total regional demand" value={totalDemand.toLocaleString()} />
        <MapMetric label="Top region" value={topRegion.region} />
        <MapMetric label="Highest growth" value={`${Math.max(...mapData.map((item) => item.growth))}%`} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {mapData
          .slice()
          .sort((a, b) => b.demand - a.demand)
          .map((region) => (
            <div key={region.region} className="rounded-md border border-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-medium">{region.region}</span>
                <span className={`rounded-md px-2 py-1 text-xs ${region.risk === "high" ? "bg-rose-50 text-rose-700" : region.risk === "medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{region.risk}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (region.demand / topRegion.demand) * 100)}%` }} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Demand {region.demand.toLocaleString()} · Growth {region.growth}%</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function MapMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function SupplyChainFlowMap() {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-slate-50 p-4 md:grid-cols-4">
      {["Supplier", "Warehouse", "Retailer", "Customer"].map((step, index) => (
        <div key={step} className="relative rounded-md border border-slate-200 bg-white p-4 text-center shadow-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">Step {index + 1}</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{step}</div>
          <div className="mt-2 text-sm text-muted-foreground">{["Source goods", "Buffer stock", "Market allocation", "Demand signal"][index]}</div>
          {index < 3 && <div className="absolute -right-3 top-1/2 hidden h-0.5 w-6 bg-primary md:block" />}
        </div>
      ))}
    </div>
  );
}
