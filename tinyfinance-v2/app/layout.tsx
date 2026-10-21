import './style.css';
import AppShell from './components/app-shell';
export const metadata={title:'TinyFinance',description:'Buchhaltungsvorbereitung TinyHäuser Brekendorf'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body><AppShell>{children}</AppShell></body></html>}
