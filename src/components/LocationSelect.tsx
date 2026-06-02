import { citiesForState, INDIAN_STATES, OTHER_CITY } from "@/data/indiaLocations";

interface LocationSelectProps {
  state: string;
  city: string;
  manualCity?: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  onManualCityChange?: (city: string) => void;
  stateError?: string;
  cityError?: string;
}

export function LocationSelect({
  state,
  city,
  manualCity = "",
  onStateChange,
  onCityChange,
  onManualCityChange,
  stateError,
  cityError,
}: LocationSelectProps) {
  const cityOptions = state ? citiesForState(state) : [];
  const unknownCity = !!state && !!city && !cityOptions.includes(city);
  const selectedOther = city === OTHER_CITY || unknownCity;
  const selectValue = selectedOther ? OTHER_CITY : city;
  const manualValue = unknownCity && !manualCity ? city : manualCity;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium">State / UT</label>
        <select
          value={state}
          onChange={(event) => {
            onStateChange(event.target.value);
            onCityChange("");
            onManualCityChange?.("");
          }}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select state or union territory</option>
          {INDIAN_STATES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {stateError && <p className="mt-1 text-xs text-destructive">{stateError}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">City</label>
        <select
          value={selectValue}
          onChange={(event) => onCityChange(event.target.value)}
          disabled={!state}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">{state ? "Select city" : "Select a state first"}</option>
          {cityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {cityError && <p className="mt-1 text-xs text-destructive">{cityError}</p>}
      </div>

      {selectedOther && (
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Enter your city</label>
          <input
            value={manualValue}
            onChange={(event) => onManualCityChange?.(event.target.value)}
            placeholder="Type your city or town"
            maxLength={60}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}
    </div>
  );
}
