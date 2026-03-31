import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/hero/HeroSection";

export function Home() {
  return (
    <div className="home-page">
      <Navbar />
      <HeroSection />
    </div>
  );
}
