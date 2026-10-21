import './style.css';
export const metadata={title:'TinyFinance',description:'Buchhaltungsvorbereitung TinyHäuser Brekendorf'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><nav aria-label="Hauptnavigation" style={{padding:"0 28px"}}><a href="/dashboard">Übersicht</a><a href="/search">Globale Suche</a><a href="/holidu">Holidu 2026</a><a href="/rental">Immobilien</a></nav>{children}</body></html>}

