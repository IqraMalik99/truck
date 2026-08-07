import "./globals.css";
import { colors, fonts } from "./lib/theme";
import Providers from "./provider";

export const metadata = {
  title: "Truck Logging | Industrial Logistics & Fleet Management",
  description:
    "Digitize your fleet management with LOGIVER - driver logs, admin dashboards, and fleet analytics.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: colors.background,
          color: colors.onBackground,
          fontFamily: fonts.body,
          overflowX: "hidden",
        }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}