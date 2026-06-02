export interface StateEntry {
  state: string;
  cities: string[];
}

export const OTHER_CITY = "Other";

export const INDIAN_LOCATIONS: StateEntry[] = [
  {
    state: "Andhra Pradesh",
    cities: [
      "Visakhapatnam",
      "Vijayawada",
      "Guntur",
      "Nellore",
      "Kurnool",
      "Tirupati",
      "Rajahmundry",
      "Kakinada",
      "Anantapur",
      "Eluru",
    ],
  },
  { state: "Arunachal Pradesh", cities: ["Itanagar", "Naharlagun", "Pasighat", "Tawang"] },
  {
    state: "Assam",
    cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tezpur"],
  },
  {
    state: "Bihar",
    cities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia"],
  },
  {
    state: "Chhattisgarh",
    cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"],
  },
  { state: "Goa", cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"] },
  {
    state: "Gujarat",
    cities: [
      "Ahmedabad",
      "Surat",
      "Vadodara",
      "Rajkot",
      "Bhavnagar",
      "Jamnagar",
      "Gandhinagar",
      "Junagadh",
      "Anand",
    ],
  },
  {
    state: "Haryana",
    cities: [
      "Faridabad",
      "Gurugram",
      "Panipat",
      "Ambala",
      "Yamunanagar",
      "Rohtak",
      "Hisar",
      "Karnal",
      "Sonipat",
    ],
  },
  {
    state: "Himachal Pradesh",
    cities: ["Shimla", "Mandi", "Solan", "Dharamshala", "Bilaspur", "Kullu"],
  },
  {
    state: "Jharkhand",
    cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh"],
  },
  {
    state: "Karnataka",
    cities: [
      "Bengaluru",
      "Mysuru",
      "Hubballi-Dharwad",
      "Mangaluru",
      "Belagavi",
      "Davanagere",
      "Ballari",
      "Tumakuru",
      "Shivamogga",
    ],
  },
  {
    state: "Kerala",
    cities: [
      "Thiruvananthapuram",
      "Kochi",
      "Kozhikode",
      "Thrissur",
      "Kollam",
      "Kannur",
      "Alappuzha",
      "Palakkad",
    ],
  },
  {
    state: "Madhya Pradesh",
    cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna"],
  },
  {
    state: "Maharashtra",
    cities: [
      "Mumbai",
      "Pune",
      "Nagpur",
      "Nashik",
      "Thane",
      "Aurangabad",
      "Solapur",
      "Kolhapur",
      "Amravati",
      "Navi Mumbai",
    ],
  },
  { state: "Manipur", cities: ["Imphal", "Thoubal", "Bishnupur"] },
  { state: "Meghalaya", cities: ["Shillong", "Tura", "Jowai"] },
  { state: "Mizoram", cities: ["Aizawl", "Lunglei", "Champhai"] },
  { state: "Nagaland", cities: ["Kohima", "Dimapur", "Mokokchung"] },
  {
    state: "Odisha",
    cities: ["Bhubaneswar", "Cuttack", "Rourkela", "Brahmapur", "Sambalpur", "Puri"],
  },
  {
    state: "Punjab",
    cities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali"],
  },
  {
    state: "Rajasthan",
    cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar", "Sikar"],
  },
  { state: "Sikkim", cities: ["Gangtok", "Namchi", "Gyalshing"] },
  {
    state: "Tamil Nadu",
    cities: [
      "Chennai",
      "Coimbatore",
      "Madurai",
      "Tiruchirappalli",
      "Salem",
      "Tirunelveli",
      "Erode",
      "Vellore",
    ],
  },
  {
    state: "Telangana",
    cities: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam"],
  },
  { state: "Tripura", cities: ["Agartala", "Udaipur", "Dharmanagar"] },
  {
    state: "Uttar Pradesh",
    cities: [
      "Lucknow",
      "Kanpur",
      "Ghaziabad",
      "Agra",
      "Varanasi",
      "Meerut",
      "Prayagraj",
      "Noida",
      "Bareilly",
      "Gorakhpur",
    ],
  },
  {
    state: "Uttarakhand",
    cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Nainital"],
  },
  {
    state: "West Bengal",
    cities: ["Kolkata", "Asansol", "Siliguri", "Durgapur", "Howrah", "Bardhaman", "Malda"],
  },
  { state: "Andaman & Nicobar Islands", cities: ["Port Blair"] },
  { state: "Chandigarh", cities: ["Chandigarh"] },
  { state: "Dadra & Nagar Haveli and Daman & Diu", cities: ["Daman", "Silvassa", "Diu"] },
  { state: "Delhi", cities: ["New Delhi", "Delhi", "Dwarka", "Rohini", "Saket", "Pitampura"] },
  { state: "Jammu & Kashmir", cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla"] },
  { state: "Ladakh", cities: ["Leh", "Kargil"] },
  { state: "Lakshadweep", cities: ["Kavaratti"] },
  { state: "Puducherry", cities: ["Puducherry", "Karaikal", "Yanam", "Mahe"] },
].map((entry) => ({ ...entry, cities: [...entry.cities, OTHER_CITY] }));

export const INDIAN_STATES = INDIAN_LOCATIONS.map((location) => location.state);

export function citiesForState(state: string): string[] {
  return INDIAN_LOCATIONS.find((location) => location.state === state)?.cities ?? [OTHER_CITY];
}

export function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/\D/g, "").slice(-10));
}

export function toIndianE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return `+91${national.slice(-10)}`;
}
