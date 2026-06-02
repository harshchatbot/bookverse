import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import type { NewListingInput } from "./listings";

// Stable Unsplash cover images (book-ish stock photography).
const SAMPLES: Omit<NewListingInput, "sellerName" | "sellerUid">[] = [
  {
    title: "HC Verma — Concepts of Physics (Vol 1 & 2)",
    author: "H. C. Verma",
    category: "jee",
    edition: "2019 Reprint",
    originalPrice: 850,
    sellingPrice: 480,
    condition: "good",
    state: "Rajasthan",
    city: "Kota",
    deliveryType: "shipping",
    description:
      "Both volumes in great shape. Minor highlighter marks in mechanics chapters. Spine intact, no torn pages. Perfect for JEE Main + Advanced prep.",
    images: [
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Gray's Anatomy for Students",
    author: "Richard Drake",
    category: "medical",
    edition: "4th Edition",
    originalPrice: 4200,
    sellingPrice: 2600,
    condition: "like_new",
    state: "Delhi",
    city: "New Delhi",
    deliveryType: "shipping",
    description:
      "Bought last year, barely used — moved to digital notes. No markings, no folds. Comes with original sleeve.",
    images: [
      "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Introduction to Algorithms (CLRS)",
    author: "Cormen, Leiserson, Rivest, Stein",
    category: "programming",
    edition: "3rd Edition",
    originalPrice: 950,
    sellingPrice: 550,
    condition: "good",
    state: "Karnataka",
    city: "Bengaluru",
    deliveryType: "shipping",
    description:
      "Classic CS reference. Some pencil notes in early chapters, easily erased. Binding solid. Great for GATE / interview prep.",
    images: [
      "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Indian Polity",
    author: "M. Laxmikanth",
    category: "upsc",
    edition: "6th Edition",
    originalPrice: 750,
    sellingPrice: 320,
    condition: "acceptable",
    state: "Maharashtra",
    city: "Mumbai",
    deliveryType: "local",
    description:
      "Cracked Prelims, no longer need it. Cover has wear, inside is fully readable with light underlines. Local pickup near Andheri.",
    images: [
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "DC Pandey — Understanding Physics (Mechanics Vol 1)",
    author: "D. C. Pandey",
    category: "neet",
    edition: "2022 Edition",
    originalPrice: 575,
    sellingPrice: 250,
    condition: "like_new",
    state: "Maharashtra",
    city: "Pune",
    deliveryType: "shipping",
    description:
      "Solved only first two chapters in pencil. Rest is untouched. Excellent value for NEET aspirants.",
    images: [
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
    ],
  },
];

export async function seedSampleListings(): Promise<number> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to seed listings.");

  const sellerName = user.displayName || "BookVerse Demo Seller";

  let count = 0;
  for (const s of SAMPLES) {
    await addDoc(collection(db, "listings"), {
      ...s,
      sellerUid: user.uid,
      sellerName,
      status: "approved",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  }
  return count;
}
