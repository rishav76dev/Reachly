import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CampaignFlowSection } from "@/components/hero/CampaignFlowSection";
import { getCampaignCount } from "@/lib/stellarCampaign";


export function HeroSection() {
  const [campaignCount, setCampaignCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadCampaignCount = async () => {
      try {
        const count = await getCampaignCount();
        if (active) {
          setCampaignCount(count);
        }
      } catch {
        if (active) {
          setCampaignCount(null);
        }
      }
    };

    void loadCampaignCount();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="hero-center" aria-label="Hero">

      <div className="hero-stage-title hero-sequence-item hero-seq-title font-['Open_Sans']  text-[clamp(3rem,7vw,5rem)] font-normal leading-[0.98] tracking-[-0.045em] text-[#14192d]">
        Fund real-world Web3  campaigns.
      </div>

      <p className="hero-stage-sub hero-sequence-item hero-seq-sub text-[20px] leading-[1.45] text-[#6b7395] max-w-[720px]">
        Featuring transparent budget allocation, proportional creator rewards,
        <br />
        and full on-chain accountability. New campaigns weekly.
      </p>

      <p className="hero-sequence-item text-[14px] leading-[1.35] text-[#3e4a7a]">
        On-chain campaigns on Stellar testnet: {campaignCount ?? "..."}
      </p>

      <div className="hero-pill-btns hero-stage-actions hero-sequence-item hero-seq-actions">
        <Link to="/dashboard" className="btn-pill-black">
          Start a Campaign
        </Link>
        <Link to="/dashboard" className="btn-pill-outline">
          Browse Campaigns <ArrowRight size={16} />
        </Link>
      </div>

      <div className="hero-stage-flow hero-sequence-item hero-seq-flow">
        <CampaignFlowSection />
      </div>
    </section>
  );
}
