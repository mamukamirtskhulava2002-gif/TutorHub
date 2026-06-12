import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TawkChat from "@/components/TawkChat";
import RealtimeNotificationAlert from "@/components/RealtimeNotificationAlert";

export const metadata = {
  title: "TutorHub — საქართველოს სასწავლო პლატფორმა",
  description: "ვერიფიცირებული კერძო მასწავლებლები ყველა საგანში. ისწავლე ონლაინ ან ადგილზე, გარანტირებული გადახდით.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <BottomNav />
        <TawkChat />
        <RealtimeNotificationAlert />
      </body>
    </html>
  );
}