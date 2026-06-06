import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { getGoogleMapsBrowserKey } from "@/lib/env";

export type GoogleAddressSelection = {
  houseOrFlat?: string;
  buildingOrSociety?: string;
  streetOrRoad?: string;
  areaOrLocality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  placeId?: string;
  formattedAddress?: string;
  lat?: number;
  lon?: number;
};

export type GooglePickupMapSelectorProps = {
  address1: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lon?: number;
  placeId?: string;
  disabled?: boolean;
  onSelection: (selection: GoogleAddressSelection) => void;
  onPinDragged: (coords: { lat: number; lon: number }) => void;
};

declare global {
  interface Window {
    google?: any;
  }
}

const browserKey = getGoogleMapsBrowserKey();

let mapsScriptPromise: Promise<void> | null = null;

function loadMapsScript() {
  if (!browserKey) {
    return Promise.reject(new Error("Google Maps browser key is missing."));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-bookverse-google-maps="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google Maps.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.bookverseGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Maps."));
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

function extractPlaceSelection(place: any): GoogleAddressSelection | null {
  const geometry = place?.geometry?.location;
  const lat = geometry?.lat?.();
  const lon = geometry?.lng?.();

  if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lon !== "number" || !Number.isFinite(lon)) {
    return null;
  }

  const components = Array.isArray(place?.address_components) ? place.address_components : [];
  const find = (type: string, preferShort = false) => {
    const component = components.find((item: any) => Array.isArray(item?.types) && item.types.includes(type));
    if (!component) return "";
    return preferShort ? component.short_name ?? component.long_name ?? "" : component.long_name ?? component.short_name ?? "";
  };

  const streetNumber = find("street_number");
  const route = find("route");
  const sublocality = find("sublocality_level_1") || find("sublocality") || find("neighborhood");
  const streetOrRoad = route || "";
  const houseOrFlat = streetNumber || "";

  return {
    houseOrFlat,
    streetOrRoad,
    areaOrLocality: sublocality || "",
    city: find("locality") || find("postal_town") || find("administrative_area_level_2"),
    state: find("administrative_area_level_1"),
    pincode: find("postal_code"),
    country: find("country"),
    placeId: typeof place?.place_id === "string" ? place.place_id : "",
    formattedAddress:
      typeof place?.formatted_address === "string" ? place.formatted_address : "",
    lat,
    lon,
  };
}

export function GooglePickupMapSelector({
  address1,
  city,
  state,
  pincode,
  lat,
  lon,
  placeId,
  disabled,
  onSelection,
  onPinDragged,
}: GooglePickupMapSelectorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const dragListenerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fallbackCenter = useMemo(
    () => ({ lat: typeof lat === "number" && Number.isFinite(lat) ? lat : 18.5204, lng: typeof lon === "number" && Number.isFinite(lon) ? lon : 73.8567 }),
    [lat, lon],
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadMapsScript();
        if (cancelled || !window.google || !mapRef.current || !inputRef.current) return;

        const google = window.google;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: fallbackCenter,
            zoom: typeof lat === "number" && typeof lon === "number" ? 16 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }

        if (!markerRef.current) {
          markerRef.current = new google.maps.Marker({
            map: mapInstanceRef.current,
            position: fallbackCenter,
            draggable: !disabled,
            title: "Pickup location",
          });
        } else {
          markerRef.current.setDraggable(!disabled);
        }

        if (dragListenerRef.current) {
          google.maps.event.removeListener(dragListenerRef.current);
        }
        dragListenerRef.current = markerRef.current.addListener("dragend", (event: any) => {
          const nextLat = event?.latLng?.lat?.();
          const nextLon = event?.latLng?.lng?.();
          if (typeof nextLat === "number" && Number.isFinite(nextLat) && typeof nextLon === "number" && Number.isFinite(nextLon)) {
            onPinDragged({ lat: nextLat, lon: nextLon });
          }
        });

        if (!autocompleteRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "in" },
            fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
          });
          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace?.();
            const selection = extractPlaceSelection(place);
            if (!selection || !mapInstanceRef.current || !markerRef.current) return;

            const position = { lat: selection.lat!, lng: selection.lon! };
            mapInstanceRef.current.setCenter(position);
            mapInstanceRef.current.setZoom(17);
            markerRef.current.setPosition(position);
            onSelection(selection);
          });
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Could not load map.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [disabled, fallbackCenter, lat, lon, onPinDragged, onSelection]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lon !== "number" || !Number.isFinite(lon)) return;
    const position = { lat, lng: lon };
    markerRef.current.setPosition(position);
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setZoom(16);
  }, [lat, lon, placeId]);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
      <div>
        <label htmlFor="pickup-place-search" className="text-sm font-medium">
          Search pickup location on map
        </label>
        <input
          ref={inputRef}
          id="pickup-place-search"
          type="text"
          placeholder="Search by building, street, college gate, or landmark"
          disabled={disabled || !browserKey}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Pick the exact courier collection spot, then drag the pin if needed.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div ref={mapRef} className="h-64 w-full" />
        <div className="border-t border-border bg-secondary/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Current pickup draft: {[address1, city, state, pincode].filter(Boolean).join(", ") || "No address selected yet"}
          </span>
        </div>
      </div>

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Google Maps…
        </p>
      )}
      {!browserKey && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Add <code>NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> to use map-based pickup validation.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
