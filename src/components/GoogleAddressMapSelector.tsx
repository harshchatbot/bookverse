import {
  GooglePickupMapSelector,
  type GooglePickupMapSelectorProps,
} from "@/components/GooglePickupMapSelector";

export type GoogleAddressMapSelectorProps = GooglePickupMapSelectorProps;

export function GoogleAddressMapSelector(props: GoogleAddressMapSelectorProps) {
  return <GooglePickupMapSelector {...props} />;
}
