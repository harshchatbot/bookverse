export const TEST_LISTING = {
  title: 'E2E Test Book — HC Verma Vol 1',
  author: 'HC Verma',
  category: 'jee',
  originalPrice: 500,
  sellingPrice: 250,
  condition: 'good',
  state: 'Maharashtra',
  city: 'Pune',
  description: 'E2E automated test listing — safe to delete',
  deliveryType: 'shipping',
};

export const TEST_PROFILE = {
  name: 'E2E Test User',
  mobile: '9999999999',
  state: 'Maharashtra',
  city: 'Pune',
  pincode: '411001',
  locality: 'Test Area',
};

export const VALIDATED_HOME_ADDRESS = {
  label: 'Home',
  pickupLocationName: 'Home',
  name: 'E2E Buyer',
  phone: '+917976111087',
  email: 'e2e-buyer@example.com',
  houseOrFlat: 'H.No 10',
  buildingOrSociety: 'Madhuban Vihar Colony',
  streetOrRoad: 'Christian Ganj',
  areaOrLocality: 'Anand Nagar',
  address1: 'H.No 10, Madhuban Vihar Colony, Christian Ganj, Anand Nagar',
  address2: 'Near Ana Sagar Lake',
  city: 'Ajmer',
  state: 'Rajasthan',
  pincode: '305001',
  country: 'India',
  landmark: 'Near Ana Sagar Lake',
  address:
    'H.No 10, Madhuban Vihar Colony, Christian Ganj, Anand Nagar, Near Ana Sagar Lake',
  formattedAddress:
    'H.No 10, Madhuban Vihar Colony, Christian Ganj, Anand Nagar, Ajmer, Rajasthan 305001, India',
  placeId: 'test-place-id',
  lat: 26.4825896,
  lon: 74.6334555,
  userConfirmed: true,
  isAddressReady: true,
  sellerConfirmed: true,
  isCourierReady: true,
  validationLevel: 'google_geo_confirmed',
  googleValidation: {
    addressComplete: false,
    validationGranularity: 'OTHER',
    geocodeGranularity: 'OTHER',
  },
};

export const TEST_PICKUP_ADDRESS = VALIDATED_HOME_ADDRESS;
