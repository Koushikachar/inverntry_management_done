import { ImageResponse } from "next/og";

export const alt = "Direct2Hub: know what you can actually sell";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0E1B2B,#0F766E)", color: "#fff" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
          <span>Direct</span>
          <span style={{ color: "#F0A202" }}>2</span>
          <span>Hub</span>
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.05, maxWidth: 950 }}>Know what you can actually sell.</div>
        <div style={{ display: "flex", fontSize: 32, opacity: 0.8 }}>Inventory for Indian sellers, wholesalers and distributors</div>
      </div>
    ),
    size
  );
}