import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, LocateFixed, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type LatLng = { lat: number; lon: number };

interface Props {
  pincode: string;
  address: string;
  city: string;
  state: string;
  coords: LatLng | null;
  onUseLocation: (data: {
    coords: LatLng;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => void;
  onMismatchChange: (mismatch: boolean) => void;
}

async function geocode(query: string): Promise<LatLng | null> {
  if (!query.trim()) return null;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    const data = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function reverseGeocode(c: LatLng) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.lat}&lon=${c.lon}`,
    { headers: { Accept: "application/json" } },
  );
  const data = (await r.json()) as {
    address?: {
      road?: string;
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      postcode?: string;
      house_number?: string;
    };
    display_name?: string;
  };
  const a = data.address ?? {};
  const street = [a.house_number, a.road, a.suburb ?? a.neighbourhood].filter(Boolean).join(", ");
  return {
    address: street || data.display_name?.split(",").slice(0, 2).join(", "),
    city: a.city ?? a.town ?? a.village,
    state: a.state,
    pincode: a.postcode,
  };
}

export function PickupMapPreview({
  pincode,
  address,
  city,
  state,
  coords,
  onUseLocation,
  onMismatchChange,
}: Props) {
  const [previewCoords, setPreviewCoords] = useState<LatLng | null>(coords);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedPostcode, setVerifiedPostcode] = useState<string | null>(null);

  useEffect(() => {
    if (coords) setPreviewCoords(coords);
  }, [coords]);

  const query = useMemo(() => {
    const parts = [address, city, state, /^\d{6}$/.test(pincode) ? pincode : "", "India"].filter(
      Boolean,
    );
    return parts.join(", ");
  }, [address, city, state, pincode]);

  // Auto-geocode preview when no saved coords yet
  useEffect(() => {
    if (coords) return;
    if (!/^\d{6}$/.test(pincode) && !city.trim()) {
      setPreviewCoords(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const c = await geocode(query);
      if (!cancelled) {
        setPreviewCoords(c);
        setLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [query, pincode, city, coords]);

  // Verify: when saved coords + 6-digit pincode are present, reverse-geocode
  // and compare. Block save if postcodes disagree.
  const verifyKey = `${coords?.lat},${coords?.lon},${pincode}`;
  const lastVerifiedKey = useRef<string>("");
  useEffect(() => {
    if (!coords || !/^\d{6}$/.test(pincode)) {
      setVerifiedPostcode(null);
      onMismatchChange(false);
      return;
    }
    if (lastVerifiedKey.current === verifyKey) return;
    lastVerifiedKey.current = verifyKey;
    let cancelled = false;
    setVerifying(true);
    reverseGeocode(coords)
      .then((rev) => {
        if (cancelled) return;
        const pc = rev.pincode ?? null;
        setVerifiedPostcode(pc);
        onMismatchChange(!!pc && pc !== pincode);
      })
      .catch(() => {
        if (cancelled) return;
        setVerifiedPostcode(null);
        onMismatchChange(false);
      })
      .finally(() => !cancelled && setVerifying(false));
    return () => {
      cancelled = true;
    };
  }, [verifyKey, coords, pincode, onMismatchChange]);

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPreviewCoords(c);
        try {
          const rev = await reverseGeocode(c);
          onUseLocation({ coords: c, ...rev });
          toast.success("Pickup location set");
        } catch {
          onUseLocation({ coords: c });
          toast.success("Location set — fill in address");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || "Could not get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const useMapCenter = () => {
    if (!previewCoords) return;
    onUseLocation({ coords: previewCoords });
    toast.success("Coordinates saved for this pickup address");
  };

  const display = previewCoords ?? coords;
  const bbox = display
    ? `${display.lon - 0.01},${display.lat - 0.008},${display.lon + 0.01},${display.lat + 0.008}`
    : null;

  const mismatch = !!(coords && /^\d{6}$/.test(pincode) && verifiedPostcode && verifiedPostcode !== pincode);
  const matched = !!(coords && /^\d{6}$/.test(pincode) && verifiedPostcode && verifiedPostcode === pincode);

  return (
    <div className="mt-4 rounded-xl border border-border bg-background">
      <div className="relative h-48 overflow-hidden rounded-t-xl bg-secondary">
        {display && bbox ? (
          <>
            <iframe
              key={`${display.lat},${display.lon}`}
              title="Pickup location preview"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${display.lat},${display.lon}`}
              className="h-full w-full border-0"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/70 to-transparent p-2 text-[11px] text-foreground/80">
              {display.lat.toFixed(5)}, {display.lon.toFixed(5)}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Locating address…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Enter city + pincode to see a map preview
              </span>
            )}
          </div>
        )}
      </div>

      {mismatch && (
        <div className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Pincode doesn&apos;t match the map point</p>
            <p className="mt-0.5">
              You entered <b>{pincode}</b>, but this location is in <b>{verifiedPostcode}</b>.
              Update the pincode or pick a different location before saving.
            </p>
          </div>
        </div>
      )}
      {matched && (
        <div className="flex items-center gap-2 border-t border-success/30 bg-success/10 p-2.5 text-xs text-success">
          <CheckCircle2 className="h-4 w-4" />
          Pincode matches the selected map point.
        </div>
      )}
      {verifying && !mismatch && !matched && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking pincode against map point…
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="text-xs text-muted-foreground">
          Confirm your pickup location for couriers.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Use my current location
          </button>
          <button
            type="button"
            onClick={useMapCenter}
            disabled={!previewCoords}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
          >
            <MapPin className="h-3.5 w-3.5" />
            Use this location
          </button>
        </div>
      </div>
    </div>
  );
}
