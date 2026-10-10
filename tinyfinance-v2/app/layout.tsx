import "./style.css";
import PreferencesBoot from "./components/preferences-boot";
export const metadata = {
  title: "TinyFinance",
  description: "Finanzen, Belege und Buchhaltung",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="de"
      data-theme="system"
      data-size="normal"
      suppressHydrationWarning
    >
      <body>
        <PreferencesBoot />
        {children}
      </body>
    </html>
  );
}
