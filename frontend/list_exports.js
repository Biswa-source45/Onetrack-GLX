import * as lucide from "lucide-react";

const keys = Object.keys(lucide);
const brands = ["github", "linkedin", "twitter", "facebook", "chrome", "globe", "social", "icon"];

brands.forEach(brand => {
  const matches = keys.filter(k => k.toLowerCase().includes(brand));
  console.log(`Matches for "${brand}":`, matches);
});
