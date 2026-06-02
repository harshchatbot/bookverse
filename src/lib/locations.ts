// Indian states/UTs with their major cities, for the cascading
// state -> city dropdowns on the sell form. Not exhaustive; covers
// the major cities sellers are most likely to be in. "Other" lets a
// seller pick any state even if their exact city isn't listed.

export interface StateEntry {
  state: string;
  cities: string[];
}

export const INDIAN_LOCATIONS: StateEntry[] = [
  { state: "Andhra Pradesh", cities: ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Rajahmundry", "Kakinada"] },
  { state: "Arunachal Pradesh", cities: ["Itanagar", "Naharlagun", "Pasighat"] },
  { state: "Assam", cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tezpur"] },
  { state: "Bihar", cities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Bihar Sharif"] },
  { state: "Chhattisgarh", cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"] },
  { state: "Goa", cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"] },
  { state: "Gujarat", cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh", "Anand"] },
  { state: "Haryana", cities: ["Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat"] },
  { state: "Himachal Pradesh", cities: ["Shimla", "Mandi", "Solan", "Dharamshala", "Bilaspur", "Kullu"] },
  { state: "Jharkhand", cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh"] },
  { state: "Karnataka", cities: ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Davanagere", "Ballari", "Tumakuru", "Shivamogga"] },
  { state: "Kerala", cities: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Palakkad"] },
  { state: "Madhya Pradesh", cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"] },
  { state: "Maharashtra", cities: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Navi Mumbai", "Sangli"] },
  { state: "Manipur", cities: ["Imphal", "Thoubal", "Bishnupur"] },
  { state: "Meghalaya", cities: ["Shillong", "Tura", "Jowai"] },
  { state: "Mizoram", cities: ["Aizawl", "Lunglei", "Champhai"] },
  { state: "Nagaland", cities: ["Kohima", "Dimapur", "Mokokchung"] },
  { state: "Odisha", cities: ["Bhubaneswar", "Cuttack", "Rourkela", "Brahmapur", "Sambalpur", "Puri", "Balasore"] },
  { state: "Punjab", cities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Pathankot"] },
  { state: "Rajasthan", cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara", "Alwar", "Sikar"] },
  { state: "Sikkim", cities: ["Gangtok", "Namchi", "Gyalshing"] },
  { state: "Tamil Nadu", cities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi"] },
  { state: "Telangana", cities: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam"] },
  { state: "Tripura", cities: ["Agartala", "Udaipur", "Dharmanagar"] },
  { state: "Uttar Pradesh", cities: ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Noida", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur"] },
  { state: "Uttarakhand", cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Nainital"] },
  { state: "West Bengal", cities: ["Kolkata", "Asansol", "Siliguri", "Durgapur", "Howrah", "Bardhaman", "Malda", "Kharagpur"] },
  // Union Territories
  { state: "Andaman & Nicobar Islands", cities: ["Port Blair"] },
  { state: "Chandigarh", cities: ["Chandigarh"] },
  { state: "Dadra & Nagar Haveli and Daman & Diu", cities: ["Daman", "Silvassa", "Diu"] },
  { state: "Delhi", cities: ["New Delhi", "Delhi", "Dwarka", "Rohini", "Saket", "Pitampura"] },
  { state: "Jammu & Kashmir", cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla"] },
  { state: "Ladakh", cities: ["Leh", "Kargil"] },
  { state: "Lakshadweep", cities: ["Kavaratti"] },
  { state: "Puducherry", cities: ["Puducherry", "Karaikal", "Yanam", "Mahe"] },
];

export const INDIAN_STATES: string[] = INDIAN_LOCATIONS.map((l) => l.state);

export function citiesForState(state: string): string[] {
  return INDIAN_LOCATIONS.find((l) => l.state === state)?.cities ?? [];
}
